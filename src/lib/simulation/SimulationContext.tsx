"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  DemoScenario,
  FeatureSet,
  ISIScore,
  PersonalBaseline,
  PhysiologicalSample,
  SimulationSettings,
  SimulationState,
  SystemStatus,
  TimelineEvent,
} from "@/lib/isi/types";
import { DEFAULT_BASELINE, deriveBaselineFromHealthRecord } from "@/lib/isi/baseline";
import { extractFeatures } from "@/lib/isi/features";
import { calculateISI } from "@/lib/isi/scoring";
import {
  extractMatrixAFeatures,
  type MatrixAFeatureVector,
} from "@/lib/isi/matrix_a";
import {
  generateHistoricalData,
  generateSample,
  generateTimeline,
  resetSimulation,
} from "@/lib/isi/simulation";
import type { PatientRecord } from "@/lib/patient-record";

interface SimulationData {
  samples: PhysiologicalSample[];
  history: ISIScore[];
  currentSample: PhysiologicalSample;
  currentScore: ISIScore;
  features: FeatureSet;
  matrixAFeatures: MatrixAFeatureVector;
  timeline: TimelineEvent[];
}

function buildSimulationData(newScenario: DemoScenario, initialModelProb?: number | null): SimulationData {
  resetSimulation();
  const { samples: historicalSamples } = generateHistoricalData(newScenario, 60);
  const historicalScores: ISIScore[] = [];

  historicalSamples.forEach((sample, i) => {
    const prev = i > 0 ? historicalSamples[i - 1] : null;
    const feat = extractFeatures(sample, prev, newScenario);
    const score = calculateISI({
      features: feat,
      baseline: DEFAULT_BASELINE,
      historicalScores: historicalScores.map((s) => s.score),
      scenario: newScenario,
      signalQuality: sample.signalQuality.overall,
      timestamp: sample.timestamp,
      modelProbability: (i === historicalSamples.length - 1 && initialModelProb !== undefined && initialModelProb !== null)
        ? initialModelProb
        : undefined,
    });
    historicalScores.push(score);
  });

  const lastSample = historicalSamples[historicalSamples.length - 1];
  const lastScore = historicalScores[historicalScores.length - 1];
  const lastFeatures = extractFeatures(
    lastSample,
    historicalSamples[historicalSamples.length - 2] ?? null,
    newScenario
  );
  const lastMatrixA = extractMatrixAFeatures(
    lastSample,
    historicalSamples[historicalSamples.length - 2] ?? null,
    newScenario,
    historicalSamples.length
  );

  return {
    samples: historicalSamples,
    history: historicalScores,
    currentSample: lastSample,
    currentScore: lastScore,
    features: lastFeatures,
    matrixAFeatures: lastMatrixA,
    timeline: generateTimeline(newScenario),
  };
}

function loadSettings(): SimulationSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem("beatahead-settings");
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {
    /* ignore invalid stored settings */
  }
  return DEFAULT_SETTINGS;
}

interface SimulationContextValue extends SimulationState {
  scenario: DemoScenario;
  setScenario: (scenario: DemoScenario) => void;
  startMonitoring: () => void;
  pauseMonitoring: () => void;
  resetMonitoring: () => void;
  systemStatus: SystemStatus;
  settings: SimulationSettings;
  updateSettings: (settings: Partial<SimulationSettings>) => void;
  showToast: (message: string) => void;
  toastMessage: string | null;
  matrixAFeatures: MatrixAFeatureVector | null;
  modelProbability: number | null;
  modelAlert: boolean;
  modelThreshold: number;
  mlServiceStatus: "healthy" | "unavailable" | "evaluating";
  lastEvaluatedAt: string | null;
  evaluateModel: () => Promise<void>;
  /** Re-fetches the health record and updates the ISI baseline. */
  refreshBaseline: () => Promise<void>;
  /** The last fetched PatientRecord (null if not yet loaded). */
  healthRecord: PatientRecord | null;
}

const DEFAULT_SETTINGS: SimulationSettings = {
  updateIntervalMs: 1000,
  autoStartMonitoring: false,
  showRangeLabels: true,
};

const SimulationContext = createContext<SimulationContextValue | null>(null);

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  const [scenario, setScenarioState] = useState<DemoScenario>("stress_event");
  const [isRunning, setIsRunning] = useState(false);
  const [simulationData, setSimulationData] = useState<SimulationData>(() =>
    buildSimulationData("stress_event")
  );

  // ── Health-record-derived baseline ─────────────────────────────────────
  const [baseline, setBaseline] = useState<PersonalBaseline>(DEFAULT_BASELINE);
  const [healthRecord, setHealthRecord] = useState<PatientRecord | null>(null);

  const refreshBaseline = useCallback(async () => {
    try {
      const res = await fetch("/api/patient-record");
      if (!res.ok) return;
      const record: PatientRecord = await res.json();
      setHealthRecord(record);
      // Only apply if the record has meaningful clinical data
      const hasData =
        record.restingHeartRate !== null ||
        record.systolicBP !== null ||
        record.bloodPressureCategory !== "" ||
        record.smokingStatus !== "" ||
        record.diabetesStatus !== "" ||
        record.cholesterolStatus !== "" ||
        record.stressLevel !== "" ||
        record.exerciseFrequency !== "" ||
        record.priorHeartAttack ||
        record.familyHeartAttack;
      if (hasData) {
        setBaseline(deriveBaselineFromHealthRecord(record));
      }
    } catch {
      // silently fall back to DEFAULT_BASELINE
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    refreshBaseline();
  }, [refreshBaseline]);
  // ──────────────────────────────────────────────────────────────────────

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<SimulationSettings>(DEFAULT_SETTINGS);
  
  // Real ML Model inference state
  const [matrixAFeatures, setMatrixAFeatures] = useState<MatrixAFeatureVector | null>(
    () => simulationData.matrixAFeatures
  );
  const [modelProbability, setModelProbability] = useState<number | null>(null);
  const [modelAlert, setModelAlert] = useState<boolean>(false);
  const [mlServiceStatus, setMlServiceStatus] = useState<"healthy" | "unavailable" | "evaluating">("evaluating");
  const [lastEvaluatedAt, setLastEvaluatedAt] = useState<string | null>(null);
  const inFlightRef = useRef<boolean>(false);
  const tickCounterRef = useRef<number>(0);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousSampleRef = useRef<PhysiologicalSample | null>(simulationData.currentSample);
  const isFirstScenarioEffect = useRef(true);

  const {
    samples,
    history,
    currentSample,
    currentScore,
    features,
    timeline,
  } = simulationData;

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    localStorage.setItem("beatahead-settings", JSON.stringify(settings));
  }, [settings]);

  const matrixAFeaturesRef = useRef<MatrixAFeatureVector | null>(simulationData.matrixAFeatures);
  matrixAFeaturesRef.current = matrixAFeatures;
  const modelProbabilityRef = useRef<number | null>(modelProbability);
  modelProbabilityRef.current = modelProbability;
  const simulationDataRef = useRef(simulationData);
  simulationDataRef.current = simulationData;

  const evaluateModel = useCallback(async (customFeats?: MatrixAFeatureVector) => {
    const targetFeats = customFeats ?? matrixAFeaturesRef.current ?? simulationDataRef.current.matrixAFeatures;
    if (!targetFeats || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await fetch("/api/ml/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features: targetFeats })
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.probability === "number") {
          setModelProbability(data.probability);
          setModelAlert(data.prediction === 1 || data.probability >= (data.threshold || 0.156742));
          setMlServiceStatus("healthy");
          setLastEvaluatedAt(new Date().toLocaleTimeString());
        }
      } else {
        setMlServiceStatus("unavailable");
      }
    } catch {
      setMlServiceStatus("unavailable");
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  const initializeData = useCallback((newScenario: DemoScenario) => {
    const data = buildSimulationData(newScenario, modelProbabilityRef.current);
    setSimulationData(data);
    setMatrixAFeatures(data.matrixAFeatures);
    previousSampleRef.current = data.currentSample;
    evaluateModel(data.matrixAFeatures);
  }, [evaluateModel]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = window.location.pathname;
      if (p.startsWith("/sign-in") || p.startsWith("/sign-up")) {
        return;
      }
    }
    if (isFirstScenarioEffect.current) {
      isFirstScenarioEffect.current = false;
      evaluateModel(simulationDataRef.current.matrixAFeatures);
      return;
    }
    initializeData(scenario);
  }, [scenario, initializeData, evaluateModel]);

  const tick = useCallback(() => {
    tickCounterRef.current++;
    setSimulationData((prev) => {
      const previousSample = previousSampleRef.current ?? prev.currentSample;
      const newSample = generateSample(scenario);
      const newFeatures = extractFeatures(newSample, previousSample, scenario);
      const newMatrixA = extractMatrixAFeatures(
        newSample,
        previousSample,
        scenario,
        prev.history.length
      );
      
      const newScore = calculateISI({
        features: newFeatures,
        baseline,
        historicalScores: prev.history.map((s) => s.score),
        scenario,
        signalQuality: newSample.signalQuality.overall,
        timestamp: newSample.timestamp,
        rawSample: {
          heartRate: newSample.heartRate,
          hrv: newSample.hrv,
          spo2: newSample.spo2,
          ppg: newSample.ppg,
          ecg: newSample.ecg,
          imu: newSample.imu,
        },
        modelProbability: modelProbabilityRef.current !== null ? modelProbabilityRef.current : undefined,
      });

      previousSampleRef.current = newSample;

      // Periodically re-evaluate ML service every 10 ticks (e.g. 10s)
      if (tickCounterRef.current % 10 === 0) {
        evaluateModel(newMatrixA);
      }

      return {
        ...prev,
        currentSample: newSample,
        currentScore: newScore,
        features: newFeatures,
        matrixAFeatures: newMatrixA,
        history: [...prev.history.slice(-119), newScore],
        samples: [...prev.samples.slice(-119), newSample],
      };
    });
  }, [scenario, baseline, evaluateModel]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(tick, settings.updateIntervalMs);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, tick, settings.updateIntervalMs]);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const updateSettings = useCallback((partial: Partial<SimulationSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const setScenario = useCallback(
    (newScenario: DemoScenario) => {
      setIsRunning(false);
      setScenarioState(newScenario);
      showToast(`Demo scenario: ${newScenario.replace(/_/g, " ")}`);
    },
    [showToast]
  );

  const startMonitoring = useCallback(() => setIsRunning(true), []);
  const pauseMonitoring = useCallback(() => setIsRunning(false), []);

  const resetMonitoring = useCallback(() => {
    setIsRunning(false);
    initializeData(scenario);
    showToast("Simulation reset");
  }, [scenario, initializeData, showToast]);

  const motionArtifactDetected =
    scenario === "motion_artifact" || (currentSample?.signalQuality.overall ?? 100) < 70;

  const systemStatus: SystemStatus = useMemo(
    () => ({
      aiEngine: mlServiceStatus === "healthy" ? "online" : mlServiceStatus === "evaluating" ? "online" : "offline",
      sensorStream: "simulated",
      signalProcessing: isRunning ? "active" : "inactive",
      isiEngine: "active",
      dataSync: "connected",
    }),
    [isRunning, mlServiceStatus]
  );

  const value: SimulationContextValue = {
    isRunning,
    scenario,
    currentSample,
    currentScore,
    history,
    samples,
    baseline,
    features,
    timeline,
    motionArtifactDetected,
    setScenario,
    startMonitoring,
    pauseMonitoring,
    resetMonitoring,
    systemStatus,
    settings,
    updateSettings,
    showToast,
    toastMessage,
    matrixAFeatures,
    modelProbability,
    modelAlert,
    modelThreshold: 0.156742,
    mlServiceStatus,
    lastEvaluatedAt,
    evaluateModel,
    refreshBaseline,
    healthRecord,
  };

  return (
    <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>
  );
}

export function useSimulation() {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error("useSimulation must be used within SimulationProvider");
  }
  return context;
}

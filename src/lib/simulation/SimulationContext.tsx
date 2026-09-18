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
import { DEFAULT_BASELINE } from "@/lib/isi/baseline";
import { extractFeatures } from "@/lib/isi/features";
import { calculateISI } from "@/lib/isi/scoring";
import {
  generateHistoricalData,
  generateSample,
  generateTimeline,
  resetSimulation,
} from "@/lib/isi/simulation";

interface SimulationData {
  samples: PhysiologicalSample[];
  history: ISIScore[];
  currentSample: PhysiologicalSample;
  currentScore: ISIScore;
  features: FeatureSet;
  timeline: TimelineEvent[];
}

function buildSimulationData(newScenario: DemoScenario): SimulationData {
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

  return {
    samples: historicalSamples,
    history: historicalScores,
    currentSample: lastSample,
    currentScore: lastScore,
    features: lastFeatures,
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
  const [baseline] = useState<PersonalBaseline>(DEFAULT_BASELINE);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<SimulationSettings>(DEFAULT_SETTINGS);
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

  const initializeData = useCallback((newScenario: DemoScenario) => {
    const data = buildSimulationData(newScenario);
    setSimulationData(data);
    previousSampleRef.current = data.currentSample;
  }, []);

  useEffect(() => {
    if (isFirstScenarioEffect.current) {
      isFirstScenarioEffect.current = false;
      return;
    }
    initializeData(scenario);
  }, [scenario, initializeData]);

  const tick = useCallback(() => {
    setSimulationData((prev) => {
      const previousSample = previousSampleRef.current ?? prev.currentSample;
      const newSample = generateSample(scenario);
      const newFeatures = extractFeatures(newSample, previousSample, scenario);
      const newScore = calculateISI({
        features: newFeatures,
        baseline,
        historicalScores: prev.history.map((s) => s.score),
        scenario,
        signalQuality: newSample.signalQuality.overall,
        timestamp: newSample.timestamp,
      });

      previousSampleRef.current = newSample;
      return {
        ...prev,
        currentSample: newSample,
        currentScore: newScore,
        features: newFeatures,
        history: [...prev.history.slice(-119), newScore],
        samples: [...prev.samples.slice(-119), newSample],
      };
    });
  }, [scenario, baseline]);

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
      aiEngine: "online",
      sensorStream: "simulated",
      signalProcessing: isRunning ? "active" : "inactive",
      isiEngine: "active",
      dataSync: "connected",
    }),
    [isRunning]
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

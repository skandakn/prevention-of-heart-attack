import os

# 1. Update src/lib/isi/types.ts
types_content = r'''export type DemoScenario =
  | "normal"
  | "stress_event"
  | "recovering"
  | "persistent_rising"
  | "motion_artifact";

export type TrendDirection = "increasing" | "decreasing" | "stable";

export type SignalQualityLevel = "excellent" | "good" | "fair" | "poor";

export type ProductState =
  | "Insufficient Signal Quality"
  | "Baseline Establishing"
  | "Normal / Stable"
  | "Elevated Model Evidence"
  | "Elevated ISI Trend";

export interface PhysiologicalSample {
  timestamp: number;
  ppg: number;
  ecg: number;
  spo2: number;
  imu: number;
  heartRate: number;
  hrv: number;
  signalQuality: {
    ppg: number;
    ecg: number;
    spo2: number;
    imu: number;
    overall: number;
  };
}

export interface FeatureSet {
  hrv: { sdnn: number; baseline: number; deviation: number; trend: TrendDirection };
  pulseMorphology: {
    amplitude: number;
    riseTime: number;
    peakCharacteristics: number;
    baseline: number;
    deviation: number;
    trend: TrendDirection;
  };
  spo2Trend: {
    average: number;
    minimum: number;
    slope: number;
    baseline: number;
    deviation: number;
    trend: TrendDirection;
  };
  ecg: {
    heartRate: number;
    rrInterval: number;
    rhythmFeature: number;
    baseline: number;
    deviation: number;
    trend: TrendDirection;
  };
  imu: {
    motionIntensity: number;
    artifactDetected: boolean;
    baseline: number;
    deviation: number;
    trend: TrendDirection;
  };
}

export interface ISIContributions {
  hrv: number;
  pulseMorphology: number;
  spo2Trend: number;
  ecg: number;
  motionArtifact: number;
  modelEvidence: number;
  autonomic: number;
  perfusion: number;
  trend: number;
}

export interface ISIScore {
  timestamp: number;
  score: number;
  rawScore: number;
  baseline: number;
  trend: TrendDirection;
  confidence: number;
  contributions: ISIContributions;
  label: string;
  deviation: number;
  modelProbability: number;
  modelEvidence: number;
  modelAlert: boolean;
  state: ProductState;
  signalQuality: number;
  baselineStatus: string;
  trendMomentum: number;
}

export interface PersonalBaseline {
  restingHR: number;
  hrv: number;
  spo2: number;
  pulseMorphology: number;
  isi: number;
}

export interface TimelineEvent {
  time: string;
  description: string;
  type: "normal" | "activity" | "isi_change" | "recovery" | "artifact";
}

export interface PatientRecord {
  id: string;
  currentISI: number;
  trend: TrendDirection;
  signalQuality: number;
  lastUpdated: string;
  baseline: PersonalBaseline;
  scores: ISIScore[];
  features: FeatureSet;
  lastSample: PhysiologicalSample;
}

export interface SimulationState {
  isRunning: boolean;
  scenario: DemoScenario;
  currentSample: PhysiologicalSample;
  currentScore: ISIScore;
  history: ISIScore[];
  samples: PhysiologicalSample[];
  baseline: PersonalBaseline;
  features: FeatureSet;
  timeline: TimelineEvent[];
  motionArtifactDetected: boolean;
}

export interface SystemStatus {
  aiEngine: "online" | "offline";
  sensorStream: "simulated" | "connected";
  signalProcessing: "active" | "inactive";
  isiEngine: "active" | "inactive";
  dataSync: "connected" | "disconnected";
}

export interface SimulationSettings {
  updateIntervalMs: 1000 | 2000 | 5000;
  autoStartMonitoring: boolean;
  showRangeLabels: boolean;
}

export const MEDICAL_DISCLAIMER =
  "BeatAhead ISI is a research/prototype screening indicator and is not a medical diagnosis. It is not intended to replace ECG, stress testing, angiography, physician assessment, or emergency medical care.";

export const SIMULATED_DATA_LABEL =
  "All displayed physiological signals are simulated and do not represent a real patient's measurements.";

export const ISI_RANGE_LABELS = {
  low: { range: "0-30", label: "Lower observed trend" },
  intermediate: { range: "31-60", label: "Intermediate observed trend" },
  high: { range: "61-100", label: "Higher observed trend" },
} as const;

export const DEMO_SCENARIOS: { id: DemoScenario; label: string; description: string }[] = [
  { id: "normal", label: "Normal", description: "ISI ~ 35-45, stable baseline" },
  { id: "stress_event", label: "Stress Event", description: "Model evidence & autonomic strain rise then recover" },
  { id: "recovering", label: "Recovering", description: "ISI gradually returning to baseline" },
  { id: "persistent_rising", label: "Persistent Rising Trend", description: "Model evidence and ISI gradually increase" },
  { id: "motion_artifact", label: "Motion Artifact", description: "Signal quality decreases, triggers quality gate" },
];
'''

with open(r"C:\ischemic\src\lib\isi\types.ts", "w", encoding="utf-8") as f:
    f.write(types_content)
print("Updated types.ts")


# 2. Update src/lib/isi/scoring.ts
scoring_content = r'''import type {
  DemoScenario,
  FeatureSet,
  ISIContributions,
  ISIScore,
  PersonalBaseline,
  TrendDirection,
} from "./types";
import { getISILabel } from "@/lib/utils";
import {
  calculateCompositeISI,
  computeModelEvidence,
  computeTrendMomentum,
  TAU_FROZEN,
  type EngineInput
} from "./engine";

export interface ScoringInput {
  features: FeatureSet;
  baseline: PersonalBaseline;
  historicalScores: number[];
  scenario: DemoScenario;
  signalQuality: number;
  timestamp?: number;
  rawSample?: {
    heartRate: number;
    hrv: number;
    spo2: number;
    ppg: number;
    ecg: number;
    imu: number;
  };
}

/**
 * Maps simulation scenarios to simulated XGBoost model probabilities.
 * Normal: sub-threshold surgical baseline (~0.005)
 * Stress Event: rises past threshold (0.156742) to ~0.35 then recovers
 * Persistent Rising: climbs past threshold to ~0.45
 * Recovering: descending from ~0.20 to baseline
 * Motion Artifact: degraded quality
 */
function getSimulatedModelProbability(scenario: DemoScenario, tickCount: number): number {
  const t = tickCount / 100.0;
  switch (scenario) {
    case "normal":
      return Math.max(0.002, 0.006 + Math.sin(t * 0.5) * 0.002);
    case "stress_event":
      if (t < 0.3) return 0.02 + Math.sin(t * 2) * 0.01;
      if (t < 0.6) return 0.16 + (t - 0.3) * 0.6; // Crosses 0.156742 threshold
      return Math.max(0.01, 0.34 - (t - 0.6) * 0.7);
    case "persistent_rising":
      return Math.min(0.55, 0.08 + t * 0.4);
    case "recovering":
      return Math.max(0.005, 0.20 - t * 0.18);
    case "motion_artifact":
      return 0.05 + Math.sin(t * 3) * 0.03;
    default:
      return 0.01;
  }
}

/**
 * BeatAhead Phase 9 ISI scoring engine.
 * Calls the audited Phase 8.1 mathematical engine.
 */
export function calculateISI(input: ScoringInput): ISIScore {
  const { features, baseline, historicalScores, scenario, signalQuality, timestamp, rawSample } = input;

  const hr = rawSample?.heartRate ?? features.ecg.heartRate;
  const sdnn = rawSample?.hrv ?? features.hrv.sdnn;
  const spo2 = rawSample?.spo2 ?? features.spo2Trend.average;
  const motionIntensity = rawSample?.imu ? Math.abs(rawSample.imu) : features.imu.motionIntensity;
  const ppgVal = rawSample?.ppg ?? 0.85;

  const modelProb = getSimulatedModelProbability(scenario, historicalScores.length);
  const isPatValid = scenario !== "motion_artifact" && signalQuality >= 60;

  const engineInput: EngineInput = {
    modelProbability: modelProb,
    ecg: {
      heartRate: hr,
      sdnn: sdnn,
      sqi: signalQuality / 100.0,
    },
    ppg: {
      sqi: signalQuality / 100.0,
      pulseAmp: ppgVal * 2000.0,
    },
    pat: {
      medianMs: 225.0 - (hr - baseline.restingHR) * 0.5,
      valid: isPatValid,
    },
    spo2: {
      current: spo2,
      available: true,
    },
    imu: {
      motionIntensity: motionIntensity,
      artifactDetected: features.imu.artifactDetected,
    },
    monitoringTimeSeconds: Math.max(650.0, historicalScores.length * 5.0),
    recentIsiHistory: historicalScores,
  };

  const output = calculateCompositeISI(engineInput);

  const trend = calculateTrend(output.isi, historicalScores);
  const confidence = Math.round(
    Math.max(30, Math.min(98, output.signalQuality * 100 - (features.imu.artifactDetected ? 35 : 0)))
  );

  const contributions: ISIContributions = {
    hrv: output.components.autonomic * 0.5,
    pulseMorphology: output.components.perfusion * 0.4,
    spo2Trend: output.components.perfusion * 0.6,
    ecg: output.components.autonomic * 0.5,
    motionArtifact: motionIntensity * 0.5,
    modelEvidence: output.components.modelEvidence,
    autonomic: output.components.autonomic,
    perfusion: output.components.perfusion,
    trend: output.components.trend,
  };

  return {
    timestamp: timestamp ?? Date.now(),
    score: output.isi,
    rawScore: output.rawIsi,
    baseline: Math.round(baseline.isi),
    trend,
    confidence,
    contributions,
    label: getISILabel(output.isi),
    deviation: output.isi - Math.round(baseline.isi),
    modelProbability: output.modelProbability,
    modelEvidence: output.components.modelEvidence,
    modelAlert: output.modelAlert,
    state: output.state,
    signalQuality: output.signalQuality,
    baselineStatus: output.baselineStatus,
    trendMomentum: output.trendMomentum,
  };
}

function calculateTrend(currentScore: number, historicalScores: number[]): TrendDirection {
  if (historicalScores.length < 5) return "stable";
  const recent = historicalScores.slice(-10);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const diff = currentScore - avg;
  if (diff > 3) return "increasing";
  if (diff < -3) return "decreasing";
  return "stable";
}
'''

with open(r"C:\ischemic\src\lib\isi\scoring.ts", "w", encoding="utf-8") as f:
    f.write(scoring_content)
print("Updated scoring.ts")

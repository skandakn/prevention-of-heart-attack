export type DemoScenario =
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

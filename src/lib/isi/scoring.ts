import type {
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
  modelProbability?: number;
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

  const modelProb = (input.modelProbability !== undefined && input.modelProbability !== null)
    ? input.modelProbability
    : getSimulatedModelProbability(scenario, historicalScores.length);
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

import type {
  DemoScenario,
  FeatureSet,
  ISIContributions,
  ISIScore,
  PersonalBaseline,
  TrendDirection,
} from "./types";
import { getISILabel } from "@/lib/utils";

export interface ScoringInput {
  features: FeatureSet;
  baseline: PersonalBaseline;
  historicalScores: number[];
  scenario: DemoScenario;
  signalQuality: number;
  timestamp?: number;
}

/**
 * Prototype ISI scoring engine.
 * Replace this function with a real XGBoost model inference call in production.
 */
export function calculateISI(input: ScoringInput): ISIScore {
  const { features, baseline, historicalScores, scenario, signalQuality, timestamp } = input;

  const hrvFactor = normalizeDeviation(features.hrv.deviation, -15, 15);
  const pulseFactor = normalizeDeviation(features.pulseMorphology.deviation, -10, 20);
  const spo2Factor = normalizeDeviation(features.spo2Trend.deviation, -3, 3);
  const ecgFactor = normalizeDeviation(features.ecg.deviation, -10, 25);
  const motionFactor = features.imu.artifactDetected ? 0.8 : Math.min(features.imu.motionIntensity, 0.5);

  const contributions: ISIContributions = {
    hrv: hrvFactor * 0.28,
    pulseMorphology: pulseFactor * 0.22,
    spo2Trend: spo2Factor * 0.18,
    ecg: ecgFactor * 0.2,
    motionArtifact: motionFactor * 0.12,
  };

  const rawScore =
    baseline.isi +
    contributions.hrv * 35 +
    contributions.pulseMorphology * 30 +
    contributions.spo2Trend * 25 +
    contributions.ecg * 35 +
    contributions.motionArtifact * 20;

  const scenarioModifier = getScenarioModifier(scenario, historicalScores.length);
  const adjustedScore = rawScore * scenarioModifier;

  const score = Math.round(Math.max(0, Math.min(100, adjustedScore)));
  const trend = calculateTrend(score, historicalScores);
  const confidence = Math.round(
    Math.max(40, Math.min(95, signalQuality * 0.85 - contributions.motionArtifact * 30))
  );

  return {
    timestamp: timestamp ?? Date.now(),
    score,
    baseline: baseline.isi,
    trend,
    confidence,
    contributions,
    label: getISILabel(score),
    deviation: score - baseline.isi,
  };
}

function normalizeDeviation(deviation: number, min: number, max: number): number {
  const clamped = Math.max(min, Math.min(max, deviation));
  return (clamped - min) / (max - min);
}

function getScenarioModifier(scenario: DemoScenario, tickCount: number): number {
  const t = tickCount / 100;
  switch (scenario) {
    case "normal":
      return 0.84 + Math.sin(t * 0.5) * 0.04;
    case "stress_event":
      if (t < 0.3) return 0.95 + Math.sin(t * 2) * 0.05;
      if (t < 0.6) return 1.0 + (t - 0.3) * 0.5;
      return 1.15 - (t - 0.6) * 0.4;
    case "recovering":
      return 1.1 - t * 0.25;
    case "persistent_rising":
      return 0.95 + t * 0.35;
    case "motion_artifact":
      return 1.0 + Math.sin(t * 3) * 0.15;
    default:
      return 1.0;
  }
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

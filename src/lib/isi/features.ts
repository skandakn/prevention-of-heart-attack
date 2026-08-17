import type { DemoScenario, FeatureSet, PhysiologicalSample, TrendDirection } from "./types";
import { DEFAULT_BASELINE } from "./baseline";

function getTrend(current: number, previous: number, threshold: number = 0.02): TrendDirection {
  const change = (current - previous) / (previous || 1);
  if (change > threshold) return "increasing";
  if (change < -threshold) return "decreasing";
  return "stable";
}

export function extractFeatures(
  sample: PhysiologicalSample,
  previousSample: PhysiologicalSample | null,
  scenario: DemoScenario
): FeatureSet {
  const baseline = DEFAULT_BASELINE;
  const prevHrv = previousSample?.hrv ?? baseline.hrv;

  const hrvDeviation = ((sample.hrv - baseline.hrv) / baseline.hrv) * 100;
  const spo2Deviation = ((sample.spo2 - baseline.spo2) / baseline.spo2) * 100;
  const hrDeviation = ((sample.heartRate - baseline.restingHR) / baseline.restingHR) * 100;

  const motionIntensity = Math.abs(sample.imu);
  const artifactDetected = scenario === "motion_artifact" || motionIntensity > 0.7;

  return {
    hrv: {
      sdnn: sample.hrv,
      baseline: baseline.hrv,
      deviation: hrvDeviation,
      trend: getTrend(sample.hrv, prevHrv),
    },
    pulseMorphology: {
      amplitude: 0.6 + sample.ppg * 0.4,
      riseTime: 0.12 + (1 - sample.ppg) * 0.08,
      peakCharacteristics: 0.7 + sample.ppg * 0.2,
      baseline: baseline.pulseMorphology,
      deviation: ((0.6 + sample.ppg * 0.4 - baseline.pulseMorphology) / baseline.pulseMorphology) * 100,
      trend: getTrend(sample.ppg, previousSample?.ppg ?? 0.5),
    },
    spo2Trend: {
      average: sample.spo2,
      minimum: sample.spo2 - 0.5,
      slope: previousSample ? sample.spo2 - previousSample.spo2 : 0,
      baseline: baseline.spo2,
      deviation: spo2Deviation,
      trend: getTrend(sample.spo2, previousSample?.spo2 ?? baseline.spo2),
    },
    ecg: {
      heartRate: sample.heartRate,
      rrInterval: 60000 / sample.heartRate,
      rhythmFeature: 0.85 + sample.ecg * 0.1,
      baseline: baseline.restingHR,
      deviation: hrDeviation,
      trend: getTrend(sample.heartRate, previousSample?.heartRate ?? baseline.restingHR),
    },
    imu: {
      motionIntensity,
      artifactDetected,
      baseline: 0.15,
      deviation: ((motionIntensity - 0.15) / 0.15) * 100,
      trend: getTrend(motionIntensity, previousSample ? Math.abs(previousSample.imu) : 0.15),
    },
  };
}

export function getContributionInfluence(value: number): string {
  if (value >= 0.3) return "Higher influence";
  if (value >= 0.15) return "Moderate influence";
  if (value >= 0.05) return "Lower influence";
  return "Minimal influence";
}

export function getConfidenceImpact(value: number): string {
  if (value >= 0.2) return "High confidence impact";
  if (value >= 0.1) return "Moderate confidence impact";
  return "Low confidence impact";
}

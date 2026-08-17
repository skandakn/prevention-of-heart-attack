import type { PersonalBaseline } from "./types";

export const DEFAULT_BASELINE: PersonalBaseline = {
  restingHR: 68,
  hrv: 51,
  spo2: 97,
  pulseMorphology: 0.85,
  isi: 48,
};

export function calculateBaselineDeviation(
  current: number,
  baseline: number
): number {
  if (baseline === 0) return 0;
  return ((current - baseline) / baseline) * 100;
}

export function getRollingBaseline(
  values: number[],
  windowSize: number = 20
): number {
  if (values.length === 0) return 0;
  const window = values.slice(-windowSize);
  return window.reduce((sum, v) => sum + v, 0) / window.length;
}

export function normalizeAgainstBaseline(
  current: number,
  baseline: number,
  sensitivity: number = 1
): number {
  const deviation = (current - baseline) / baseline;
  return Math.max(0, Math.min(1, 0.5 + deviation * sensitivity));
}

export function updateBaseline(
  current: PersonalBaseline,
  newValues: Partial<PersonalBaseline>,
  alpha: number = 0.05
): PersonalBaseline {
  return {
    restingHR: newValues.restingHR
      ? current.restingHR * (1 - alpha) + newValues.restingHR * alpha
      : current.restingHR,
    hrv: newValues.hrv
      ? current.hrv * (1 - alpha) + newValues.hrv * alpha
      : current.hrv,
    spo2: newValues.spo2
      ? current.spo2 * (1 - alpha) + newValues.spo2 * alpha
      : current.spo2,
    pulseMorphology: newValues.pulseMorphology
      ? current.pulseMorphology * (1 - alpha) + newValues.pulseMorphology * alpha
      : current.pulseMorphology,
    isi: newValues.isi
      ? current.isi * (1 - alpha) + newValues.isi * alpha
      : current.isi,
  };
}

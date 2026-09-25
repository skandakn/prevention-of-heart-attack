import type { PersonalBaseline } from "./types";
import type { PatientRecord } from "@/lib/patient-record";

export const DEFAULT_BASELINE: PersonalBaseline = {
  restingHR: 68,
  hrv: 51,
  spo2: 97,
  pulseMorphology: 0.85,
  isi: 48,
};

/**
 * Derives a PersonalBaseline from a saved PatientRecord (health-record form data).
 *
 * The ISI baseline starts at 40 (low-normal) and accumulates risk points from
 * clinical factors recorded in the health record:
 *
 *   Blood pressure category → +0 to +18 pts
 *   Resting heart rate (if known) → adjusts restingHR baseline
 *   Smoking → +0 to +8 pts
 *   Diabetes status → +0 to +10 pts
 *   Cholesterol status → +0 to +8 pts
 *   Stress level → +0 to +9 pts
 *   Exercise frequency → −8 to 0 pts (protective)
 *   Family history of heart attack → +4 pts
 *   Prior heart attack / angina → +10 pts
 *   Chest pain history → +5 pts
 *   Shortness of breath → +3 pts
 *
 * Maximum possible ISI baseline ≈ 75 (still within 0-100 engine range).
 */
export function deriveBaselineFromHealthRecord(record: PatientRecord): PersonalBaseline {
  let isiBase = 40;

  // ── Blood pressure ──────────────────────────────────
  switch (record.bloodPressureCategory) {
    case "elevated":      isiBase += 6;  break;
    case "high_stage_1":  isiBase += 12; break;
    case "high_stage_2":  isiBase += 18; break;
    // "normal" or "unknown" → no change
  }

  // If explicit systolic/diastolic values are recorded, refine further
  if (record.systolicBP !== null && record.diastolicBP !== null) {
    const sys = record.systolicBP;
    if (sys >= 180) isiBase = Math.max(isiBase, isiBase + 5);
    else if (sys >= 140) isiBase = Math.max(isiBase, isiBase + 2);
  }

  // ── Smoking ─────────────────────────────────────────
  switch (record.smokingStatus) {
    case "former":  isiBase += 3; break;
    case "current": isiBase += 8; break;
  }

  // ── Diabetes ────────────────────────────────────────
  switch (record.diabetesStatus) {
    case "pre_diabetic": isiBase += 4;  break;
    case "type_1":       isiBase += 8;  break;
    case "type_2":       isiBase += 10; break;
  }

  // ── Cholesterol ─────────────────────────────────────
  switch (record.cholesterolStatus) {
    case "borderline": isiBase += 3; break;
    case "high":       isiBase += 8; break;
  }

  // ── Stress level ────────────────────────────────────
  switch (record.stressLevel) {
    case "moderate":  isiBase += 3; break;
    case "high":      isiBase += 6; break;
    case "very_high": isiBase += 9; break;
  }

  // ── Exercise (protective) ────────────────────────────
  switch (record.exerciseFrequency) {
    case "active":   isiBase -= 8; break;
    case "moderate": isiBase -= 4; break;
    case "light":    isiBase -= 1; break;
    // "sedentary" → no protection
  }

  // ── Family / personal cardiac history ───────────────
  if (record.familyHeartAttack)   isiBase += 4;
  if (record.priorHeartAttack)    isiBase += 10;
  if (record.priorAngina)         isiBase += 7;
  if (record.chestPainHistory)    isiBase += 5;
  if (record.shortnessOfBreath)   isiBase += 3;
  if (record.familyHypertension)  isiBase += 2;
  if (record.familyDiabetes)      isiBase += 2;

  // ── Clamp to reasonable range ───────────────────────
  const clampedIsi = Math.max(28, Math.min(82, Math.round(isiBase)));

  // ── Resting heart rate ──────────────────────────────
  const restingHR = record.restingHeartRate !== null
    ? Math.max(40, Math.min(120, record.restingHeartRate))
    : DEFAULT_BASELINE.restingHR;

  // ── HRV (approximate from HR: lower HR ≈ higher HRV) ─
  const hrv = Math.max(20, Math.min(80, Math.round(70 - (restingHR - 60) * 0.6)));

  return {
    restingHR,
    hrv,
    spo2: DEFAULT_BASELINE.spo2,
    pulseMorphology: DEFAULT_BASELINE.pulseMorphology,
    isi: clampedIsi,
  };
}

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

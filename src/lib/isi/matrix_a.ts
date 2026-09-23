/**
 * src/lib/isi/matrix_a.ts
 *
 * BeatAhead 26-Feature Matrix A Generator
 * Aligned 100% with models/feature_schema.json (SHA-256: 49f52c07ef101114cad596e74e843b740dbf633063ca386a29221688da7be4ff)
 * 
 * Maps simulated physiological waveforms & vitals to the exact 26-feature
 * multimodal vector required by the frozen Phase 5 XGBoost model.
 */

import type { DemoScenario, PhysiologicalSample } from './types';

export const CANONICAL_MATRIX_A_FEATURES = [
  'ecg_hr_mean',
  'ecg_hr_std',
  'ecg_rr_sdnn',
  'ecg_rr_rmssd',
  'ecg_pnn50',
  'ecg_r_amp_mv',
  'ecg_qrs_width_ms',
  'ecg_sqi',
  'pat_median_ms',
  'pat_iqr_ms',
  'pat_valid_fraction',
  'pat_valid',
  'ppg_pulse_amp',
  'ppg_perfusion_index',
  'ppg_crest_time_ms',
  'ppg_sqi',
  'spo2_mean',
  'spo2_min',
  'spo2_std',
  'spo2_desat_count',
  'st_obs_mean',
  'st_obs_median',
  'st_obs_min',
  'st_obs_std',
  'st_delta_baseline',
  'st_slope_mm_min'
] as const;

export type MatrixAFeatureName = typeof CANONICAL_MATRIX_A_FEATURES[number];
export type MatrixAFeatureVector = Record<MatrixAFeatureName, number>;

export const MATRIX_A_BOUNDS: Record<MatrixAFeatureName, [number, number]> = {
  ecg_hr_mean: [20.0, 300.0],
  ecg_hr_std: [0.0, 150.0],
  ecg_rr_sdnn: [0.0, 1000.0],
  ecg_rr_rmssd: [0.0, 1000.0],
  ecg_pnn50: [0.0, 100.0],
  ecg_r_amp_mv: [-2.0, 15.0],
  ecg_qrs_width_ms: [30.0, 300.0],
  ecg_sqi: [0.0, 1.0],
  pat_median_ms: [50.0, 600.0],
  pat_iqr_ms: [0.0, 500.0],
  pat_valid_fraction: [0.0, 1.0],
  pat_valid: [0, 1],
  ppg_pulse_amp: [0.0, 50000.0],
  ppg_perfusion_index: [0.0, 10000.0],
  ppg_crest_time_ms: [20.0, 500.0],
  ppg_sqi: [0.0, 1.0],
  spo2_mean: [40.0, 100.0],
  spo2_min: [30.0, 100.0],
  spo2_std: [0.0, 40.0],
  spo2_desat_count: [0, 300],
  st_obs_mean: [-15.0, 15.0],
  st_obs_median: [-15.0, 15.0],
  st_obs_min: [-15.0, 15.0],
  st_obs_std: [0.0, 15.0],
  st_delta_baseline: [-15.0, 15.0],
  st_slope_mm_min: [-20.0, 20.0]
};

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Extracts the exact 26-feature Matrix A vector from a physiological sample
 * and simulation context, conforming strictly to the bounds and definitions
 * of models/feature_schema.json.
 */
export function extractMatrixAFeatures(
  sample: PhysiologicalSample,
  previousSample: PhysiologicalSample | null,
  scenario: DemoScenario,
  tickCount: number = 0
): MatrixAFeatureVector {
  const t = (tickCount % 200) / 100.0;
  const hr = sample.heartRate;
  const hrv = sample.hrv;
  const spo2 = sample.spo2;
  const ppgSqi = sample.signalQuality.ppg / 100.0;
  const ecgSqi = sample.signalQuality.ecg / 100.0;
  const isMotion = scenario === 'motion_artifact' || Math.abs(sample.imu) > 0.65;

  let hrStd = 4.2;
  let rmssd = hrv * 0.75;
  let pnn50 = clamp(hrv * 0.25, 0, 100);
  let rAmp = 1.1;
  let qrsWidth = 88.0;
  let patMedian = 225.0 - (hr - 70) * 0.5;
  let patIqr = 18.0;
  let patValidFraction = 0.92;
  let pulseAmp = clamp((0.5 + sample.ppg * 0.5) * 2400.0, 100.0, 4800.0);
  let perfIndex = clamp((0.6 + sample.ppg * 0.4) * 3.5, 0.2, 8.0);
  let crestTime = 110.0;
  let spo2Min = spo2 - 0.5;
  let spo2Std = 0.4;
  let spo2DesatSec = 0;

  let stMean = 0.08;
  let stMedian = 0.08;
  let stMin = -0.05;
  let stStd = 0.12;
  let stDelta = 0.02;
  let stSlope = 0.01;

  if (scenario === 'stress_event') {
    const stressProg = t < 0.2 ? 0 : t < 0.6 ? (t - 0.2) / 0.4 : Math.max(0, 1 - (t - 0.6) / 0.4);
    hrStd = 4.0 + stressProg * 10.5;
    rmssd = Math.max(8.0, hrv * 0.75 - stressProg * 15.0);
    pnn50 = Math.max(1.0, pnn50 - stressProg * 10.0);
    rAmp = 1.1 - stressProg * 0.28;
    qrsWidth = 88.0 + stressProg * 20.0;
    patMedian = 225.0 + stressProg * 55.0;
    patIqr = 18.0 + stressProg * 25.0;
    pulseAmp = Math.max(700.0, pulseAmp - stressProg * 1200.0);
    perfIndex = Math.max(0.8, perfIndex - stressProg * 2.2);
    crestTime = 110.0 + stressProg * 45.0;
    spo2Min = spo2 - 1.0 - stressProg * 5.0;
    spo2Std = 0.4 + stressProg * 2.8;
    spo2DesatSec = stressProg > 0.5 ? Math.round(stressProg * 45) : 0;

    stMean = 0.08 - stressProg * 1.73;
    stMedian = 0.08 - stressProg * 1.80;
    stMin = stMedian - (0.2 + stressProg * 0.45);
    stStd = 0.12 + stressProg * 0.30;
    stDelta = -stressProg * 1.50;
    stSlope = -stressProg * 0.38;
  } else if (scenario === 'persistent_rising') {
    const prog = Math.min(1.0, 0.2 + t * 0.7);
    hrStd = 5.0 + prog * 9.0;
    rmssd = Math.max(10.0, hrv * 0.7 - prog * 12.0);
    pnn50 = Math.max(2.0, pnn50 - prog * 8.0);
    patMedian = 230.0 + prog * 50.0;
    pulseAmp = Math.max(800.0, pulseAmp - prog * 1000.0);
    stMean = 0.05 - prog * 1.60;
    stMedian = 0.05 - prog * 1.65;
    stMin = stMedian - 0.4;
    stStd = 0.15 + prog * 0.25;
    stDelta = -prog * 1.45;
    stSlope = -prog * 0.32;
  } else if (scenario === 'recovering') {
    const recov = Math.min(1.0, t * 1.2);
    const residual = Math.max(0, 1.0 - recov);
    stMean = -0.8 * residual + 0.05 * recov;
    stMedian = -0.85 * residual + 0.05 * recov;
    stMin = stMedian - 0.25 * residual;
    stDelta = -0.7 * residual;
    stSlope = 0.15 * residual;
    patMedian = 250.0 * residual + 225.0 * recov;
  } else if (isMotion) {
    patIqr = 75.0;
    patValidFraction = 0.35;
    stStd = 0.85;
    hrStd = 18.0;
  }

  const patValid = patValidFraction >= 0.30 && !isMotion ? 1 : 0;

  const rawFeatures: MatrixAFeatureVector = {
    ecg_hr_mean: clamp(hr, MATRIX_A_BOUNDS.ecg_hr_mean[0], MATRIX_A_BOUNDS.ecg_hr_mean[1]),
    ecg_hr_std: clamp(hrStd, MATRIX_A_BOUNDS.ecg_hr_std[0], MATRIX_A_BOUNDS.ecg_hr_std[1]),
    ecg_rr_sdnn: clamp(hrv, MATRIX_A_BOUNDS.ecg_rr_sdnn[0], MATRIX_A_BOUNDS.ecg_rr_sdnn[1]),
    ecg_rr_rmssd: clamp(rmssd, MATRIX_A_BOUNDS.ecg_rr_rmssd[0], MATRIX_A_BOUNDS.ecg_rr_rmssd[1]),
    ecg_pnn50: clamp(pnn50, MATRIX_A_BOUNDS.ecg_pnn50[0], MATRIX_A_BOUNDS.ecg_pnn50[1]),
    ecg_r_amp_mv: clamp(rAmp, MATRIX_A_BOUNDS.ecg_r_amp_mv[0], MATRIX_A_BOUNDS.ecg_r_amp_mv[1]),
    ecg_qrs_width_ms: clamp(qrsWidth, MATRIX_A_BOUNDS.ecg_qrs_width_ms[0], MATRIX_A_BOUNDS.ecg_qrs_width_ms[1]),
    ecg_sqi: clamp(ecgSqi, MATRIX_A_BOUNDS.ecg_sqi[0], MATRIX_A_BOUNDS.ecg_sqi[1]),
    pat_median_ms: clamp(patMedian, MATRIX_A_BOUNDS.pat_median_ms[0], MATRIX_A_BOUNDS.pat_median_ms[1]),
    pat_iqr_ms: clamp(patIqr, MATRIX_A_BOUNDS.pat_iqr_ms[0], MATRIX_A_BOUNDS.pat_iqr_ms[1]),
    pat_valid_fraction: clamp(patValidFraction, MATRIX_A_BOUNDS.pat_valid_fraction[0], MATRIX_A_BOUNDS.pat_valid_fraction[1]),
    pat_valid: patValid,
    ppg_pulse_amp: clamp(pulseAmp, MATRIX_A_BOUNDS.ppg_pulse_amp[0], MATRIX_A_BOUNDS.ppg_pulse_amp[1]),
    ppg_perfusion_index: clamp(perfIndex, MATRIX_A_BOUNDS.ppg_perfusion_index[0], MATRIX_A_BOUNDS.ppg_perfusion_index[1]),
    ppg_crest_time_ms: clamp(crestTime, MATRIX_A_BOUNDS.ppg_crest_time_ms[0], MATRIX_A_BOUNDS.ppg_crest_time_ms[1]),
    ppg_sqi: clamp(ppgSqi, MATRIX_A_BOUNDS.ppg_sqi[0], MATRIX_A_BOUNDS.ppg_sqi[1]),
    spo2_mean: clamp(spo2, MATRIX_A_BOUNDS.spo2_mean[0], MATRIX_A_BOUNDS.spo2_mean[1]),
    spo2_min: clamp(spo2Min, MATRIX_A_BOUNDS.spo2_min[0], MATRIX_A_BOUNDS.spo2_min[1]),
    spo2_std: clamp(spo2Std, MATRIX_A_BOUNDS.spo2_std[0], MATRIX_A_BOUNDS.spo2_std[1]),
    spo2_desat_count: clamp(spo2DesatSec, MATRIX_A_BOUNDS.spo2_desat_count[0], MATRIX_A_BOUNDS.spo2_desat_count[1]),
    st_obs_mean: clamp(stMean, MATRIX_A_BOUNDS.st_obs_mean[0], MATRIX_A_BOUNDS.st_obs_mean[1]),
    st_obs_median: clamp(stMedian, MATRIX_A_BOUNDS.st_obs_median[0], MATRIX_A_BOUNDS.st_obs_median[1]),
    st_obs_min: clamp(stMin, MATRIX_A_BOUNDS.st_obs_min[0], MATRIX_A_BOUNDS.st_obs_min[1]),
    st_obs_std: clamp(stStd, MATRIX_A_BOUNDS.st_obs_std[0], MATRIX_A_BOUNDS.st_obs_std[1]),
    st_delta_baseline: clamp(stDelta, MATRIX_A_BOUNDS.st_delta_baseline[0], MATRIX_A_BOUNDS.st_delta_baseline[1]),
    st_slope_mm_min: clamp(stSlope, MATRIX_A_BOUNDS.st_slope_mm_min[0], MATRIX_A_BOUNDS.st_slope_mm_min[1]),
  };

  return rawFeatures;
}

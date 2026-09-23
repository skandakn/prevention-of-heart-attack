/**
 * src/lib/isi/engine.ts
 * 
 * BeatAhead Ischemic Stress Index (ISI) Engine
 * Implements the frozen Phase 8 / 8.1 specification.
 * 
 * ARCHITECTURAL INVARIANTS:
 * 1. Model Decision Threshold is frozen at tau = 0.156742.
 * 2. Model Probability is NOT the ISI score (p_model is non-linearly transformed).
 * 3. Guaranteed score bounds: 0 <= ISI <= 100 under all inputs.
 * 4. Gated Anti-Drift: Personal baseline updates lock during elevated states.
 * 5. Strictly non-diagnostic: Provides multi-source physiological trend synthesis only.
 */

export const TAU_FROZEN = 0.156742;
export const GAMMA1_BASE = 1.4;
export const GAMMA2_BASE = 4.0;
export const W_MODEL_BASE = 0.45;
export const W_AUTO_BASE = 0.30;
export const W_PERF_BASE = 0.25;
export const ISI_BASE = 40.0;
export const SCALE_BASE = 60.0;
export const ALPHA_EMA_BASE = 0.02; // Prototype engineering parameter
export const MIN_SIGNAL_QUALITY = 0.35;
export const BASELINE_INIT_SECONDS = 600.0;

export type ProductState =
  | "Insufficient Signal Quality"
  | "Baseline Establishing"
  | "Normal / Stable"
  | "Elevated Model Evidence"
  | "Elevated ISI Trend";

export interface EngineInput {
  modelProbability: number;
  ecg: {
    heartRate: number;
    sdnn: number;
    sqi: number;
  };
  ppg: {
    sqi: number;
    pulseAmp?: number;
  };
  pat: {
    medianMs: number;
    valid: boolean | number;
  };
  spo2: {
    current: number;
    available?: boolean;
  };
  imu: {
    motionIntensity: number;
    artifactDetected?: boolean;
  };
  monitoringTimeSeconds?: number;
  recentIsiHistory?: number[];
}

export interface EngineOutput {
  isi: number;
  rawIsi: number;
  modelProbability: number;
  modelAlert: boolean;
  state: ProductState;
  signalQuality: number;
  baselineStatus: string;
  trendMomentum: number;
  components: {
    modelEvidence: number;
    autonomic: number;
    perfusion: number;
    trend: number;
  };
  qualityMetrics: {
    ecgSqi: number;
    ppgSqi: number;
    patValid: boolean;
    motionIntensity: number;
  };
}

export interface BaselineValues {
  restingHR: number;
  sdnn: number;
  spo2: number;
  pat: number;
  isi: number;
}

/**
 * Task 2: Model Evidence Non-Linear Transformation
 * Monotonic piecewise sigmoidal mapping centering tau = 0.156742 at 0.50.
 */
export function computeModelEvidence(
  p: number,
  tau: number = TAU_FROZEN,
  gamma1: number = GAMMA1_BASE,
  gamma2: number = GAMMA2_BASE
): number {
  const pClamped = Math.max(0.0, Math.min(1.0, isNaN(p) ? 0.0 : p));
  if (pClamped < tau) {
    return 0.50 * Math.pow(pClamped / tau, gamma1);
  } else {
    const normDelta = tau < 1.0 ? (pClamped - tau) / (1.0 - tau) : 0.0;
    return 0.50 + 0.50 * (1.0 - Math.exp(-gamma2 * normDelta));
  }
}

/**
 * Task 3: Autonomic Component D_auto in [0, 1]
 */
export function computeAutonomicComponent(
  hr: number,
  hrBase: number,
  sdnn: number,
  sdnnBase: number
): number {
  const fHr = Math.max(0.0, Math.min(1.0, (hr - hrBase) / 25.0));
  const fHrv = sdnnBase > 0 ? Math.max(0.0, Math.min(1.0, (sdnnBase - sdnn) / (0.60 * sdnnBase))) : 0.0;
  return 0.50 * fHr + 0.50 * fHrv;
}

/**
 * Task 4: Perfusion Component D_perf in [0, 1]
 */
export function computePerfusionComponent(
  spo2: number,
  spo2Base: number,
  pat: number,
  patBase: number,
  patValid: boolean
): number {
  const fSpo2 = Math.max(0.0, Math.min(1.0, (spo2Base - spo2) / 5.0));
  if (patValid && patBase > 0) {
    const fPat = Math.max(0.0, Math.min(1.0, (patBase - pat) / 50.0));
    return 0.60 * fSpo2 + 0.40 * fPat;
  }
  return fSpo2;
}

/**
 * Task 5: Trend Momentum M_trend in [-0.15, +0.15]
 */
export function computeTrendMomentum(recentScores?: number[]): number {
  if (!recentScores || recentScores.length < 5) return 0.0;
  const n = Math.min(recentScores.length, 10);
  const window = recentScores.slice(-n);
  const diff = window[window.length - 1] - window[0];
  const velocity = diff / (n / 2.0); // Approximate points per minute
  return Math.max(-0.15, Math.min(0.15, velocity / 2.0));
}

/**
 * Task 6: Overall Signal Quality Q_overall in [0, 1]
 */
export function computeSignalQuality(
  qEcg: number,
  qPpg: number,
  vPat: boolean,
  iMotion: number
): number {
  const cleanEcg = Math.max(0.0, Math.min(1.0, isNaN(qEcg) ? 0.0 : qEcg));
  const cleanPpg = Math.max(0.0, Math.min(1.0, isNaN(qPpg) ? 0.0 : qPpg));
  const cleanMotion = Math.max(0.0, Math.min(1.0, isNaN(iMotion) ? 0.0 : iMotion));
  const patFactor = vPat ? 1.0 : 0.0;

  return 0.40 * cleanEcg + 0.35 * cleanPpg + 0.15 * patFactor + 0.10 * (1.0 - cleanMotion);
}

/**
 * Task 7: Baseline Engine with Anti-Drift Locking
 */
export class PersonalBaselineTracker {
  private baseline: BaselineValues = {
    restingHR: 68.0,
    sdnn: 50.0,
    spo2: 98.0,
    pat: 225.0,
    isi: 40.0,
  };

  private observationCount: number = 0;
  private cleanObservationCount: number = 0;
  private isEstablished: boolean = false;
  private readonly alpha: number;

  constructor(initialValues?: Partial<BaselineValues>, alpha: number = ALPHA_EMA_BASE) {
    if (initialValues) {
      this.baseline = { ...this.baseline, ...initialValues };
    }
    this.alpha = alpha;
  }

  public getBaseline(): BaselineValues {
    return { ...this.baseline };
  }

  public getStatus(): string {
    if (!this.isEstablished) {
      const pct = Math.min(100, Math.round((this.cleanObservationCount / (BASELINE_INIT_SECONDS / 5.0)) * 100));
      return `Establishing (${pct}%)`;
    }
    return "Established (Adaptive Anti-Drift)";
  }

  public update(
    sample: { hr: number; sdnn: number; spo2: number; pat: number; isi: number },
    quality: number,
    currentState: ProductState
  ): void {
    this.observationCount++;

    if (quality >= 0.70) {
      this.cleanObservationCount++;
    }

    if (!this.isEstablished) {
      if (this.cleanObservationCount >= (BASELINE_INIT_SECONDS / 5.0) * 0.80) {
        this.isEstablished = true;
      }
      return;
    }

    // Safety-Critical Anti-Drift Rule: Freeze updates during elevated stress/model alerts
    if (currentState !== "Normal / Stable") {
      return;
    }

    // Quality gate for update
    if (quality < 0.70) {
      return;
    }

    // Exponential Moving Average update
    this.baseline.restingHR = (1 - this.alpha) * this.baseline.restingHR + this.alpha * sample.hr;
    this.baseline.sdnn = (1 - this.alpha) * this.baseline.sdnn + this.alpha * sample.sdnn;
    this.baseline.spo2 = (1 - this.alpha) * this.baseline.spo2 + this.alpha * sample.spo2;
    if (sample.pat > 0) {
      this.baseline.pat = (1 - this.alpha) * this.baseline.pat + this.alpha * sample.pat;
    }
    this.baseline.isi = (1 - this.alpha) * this.baseline.isi + this.alpha * sample.isi;
  }
}

/**
 * Task 9: Five-State Machine Controller
 */
export function determineProductState(
  qOverall: number,
  monitoringTimeSeconds: number,
  pModel: number,
  isiScore: number
): ProductState {
  if (qOverall < MIN_SIGNAL_QUALITY) {
    return "Insufficient Signal Quality";
  }
  if (monitoringTimeSeconds < BASELINE_INIT_SECONDS) {
    return "Baseline Establishing";
  }
  if (pModel >= TAU_FROZEN) {
    return "Elevated Model Evidence";
  }
  if (isiScore >= 61) {
    return "Elevated ISI Trend";
  }
  return "Normal / Stable";
}

/**
 * Task 8: Primary ISI Engine Entrypoint
 */
export function calculateCompositeISI(
  input: EngineInput,
  baselineTracker?: PersonalBaselineTracker
): EngineOutput {
  const isPatValid = Boolean(input.pat.valid);
  const qOverall = computeSignalQuality(
    input.ecg.sqi,
    input.ppg.sqi,
    isPatValid,
    input.imu.motionIntensity
  );

  const monitoringTime = input.monitoringTimeSeconds ?? 1200.0;
  const modelProb = input.modelProbability ?? 0.0;
  const modelAlert = modelProb >= TAU_FROZEN;

  const tracker = baselineTracker ?? new PersonalBaselineTracker();
  const baseline = tracker.getBaseline();

  // If signal quality is insufficient, prevent false precision
  if (qOverall < MIN_SIGNAL_QUALITY) {
    return {
      isi: 0,
      rawIsi: 0,
      modelProbability: modelProb,
      modelAlert,
      state: "Insufficient Signal Quality",
      signalQuality: qOverall,
      baselineStatus: tracker.getStatus(),
      trendMomentum: 0.0,
      components: {
        modelEvidence: 0.0,
        autonomic: 0.0,
        perfusion: 0.0,
        trend: 0.0,
      },
      qualityMetrics: {
        ecgSqi: input.ecg.sqi,
        ppgSqi: input.ppg.sqi,
        patValid: isPatValid,
        motionIntensity: input.imu.motionIntensity,
      },
    };
  }

  // Component calculations
  const eModel = computeModelEvidence(modelProb);
  const dAuto = computeAutonomicComponent(
    input.ecg.heartRate,
    baseline.restingHR,
    input.ecg.sdnn,
    baseline.sdnn
  );
  const dPerf = computePerfusionComponent(
    input.spo2.current,
    baseline.spo2,
    input.pat.medianMs,
    baseline.pat,
    isPatValid
  );
  const mTrend = computeTrendMomentum(input.recentIsiHistory);

  // Exact Phase 8 Synthesis Formula
  const innerSum =
    W_MODEL_BASE * (eModel - 0.20) +
    W_AUTO_BASE * dAuto +
    W_PERF_BASE * dPerf +
    mTrend;

  const rawScore = baseline.isi + innerSum * SCALE_BASE;

  // Clamping Invariant: 0 <= ISI <= 100
  const clampedScore = Math.round(Math.max(0.0, Math.min(100.0, rawScore)));

  // State Machine
  const state = determineProductState(qOverall, monitoringTime, modelProb, clampedScore);

  // Update baseline tracker with anti-drift protection
  tracker.update(
    {
      hr: input.ecg.heartRate,
      sdnn: input.ecg.sdnn,
      spo2: input.spo2.current,
      pat: isPatValid ? input.pat.medianMs : 0,
      isi: clampedScore,
    },
    qOverall,
    state
  );

  return {
    isi: clampedScore,
    rawIsi: rawScore,
    modelProbability: modelProb,
    modelAlert,
    state,
    signalQuality: qOverall,
    baselineStatus: tracker.getStatus(),
    trendMomentum: mTrend,
    components: {
      modelEvidence: eModel,
      autonomic: dAuto,
      perfusion: dPerf,
      trend: mTrend,
    },
    qualityMetrics: {
      ecgSqi: input.ecg.sqi,
      ppgSqi: input.ppg.sqi,
      patValid: isPatValid,
      motionIntensity: input.imu.motionIntensity,
    },
  };
}

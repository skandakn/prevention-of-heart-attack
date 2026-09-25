"""
BeatAhead Phase 10: End-to-End Validation and Demo Hardening Test Suite
------------------------------------------------------------------------
Tests the complete multi-stage pipeline:
Raw physiological streaming -> Signal Quality Assessment -> 26-Feature Vector ->
ML Inference Service -> Frozen Model Probability -> Operating Threshold (0.156742) ->
Model Alert State -> Sigmoidal Model Evidence -> Personal Baseline Tracking ->
Autonomic Strain -> Perfusion Strain -> Trend Momentum -> Composite ISI (0-100) ->
5-State Machine Controller -> Presentation View Model.
"""

import unittest
import json
import math
import numpy as np
from src.inference import BeatAheadInferenceEngine, FeatureValidationError

FROZEN_THRESHOLD = 0.156742

# --- Complete Python Mirror of C:\ischemic\src\lib\isi\engine.ts ---

def calculate_model_evidence(p: float, tau: float = FROZEN_THRESHOLD) -> float:
    p_clamped = max(0.0, min(1.0, float(p)))
    k1 = 2.5
    k2 = 3.5
    if p_clamped <= tau:
        denom = 1.0 - math.exp(-k1)
        if abs(denom) < 1e-9:
            return 0.5 * (p_clamped / tau)
        return 0.50 * ((1.0 - math.exp(-k1 * (p_clamped / tau))) / denom)
    else:
        denom = 1.0 - math.exp(-k2)
        ratio = (p_clamped - tau) / (1.0 - tau)
        if abs(denom) < 1e-9:
            return 0.50 + 0.50 * ratio
        return 0.50 + 0.50 * ((1.0 - math.exp(-k2 * ratio)) / denom)

def calculate_autonomic_strain(hr: float, hr_base: float, rmssd: float, rmssd_base: float) -> float:
    d_hr = max(-0.50, min(1.00, (hr - hr_base) / 30.0))
    d_rmssd = max(0.00, min(1.00, (rmssd_base - rmssd) / max(1e-3, rmssd_base)))
    return 0.60 * d_hr + 0.40 * d_rmssd

def calculate_perfusion_strain(spo2: float, spo2_base: float, pat: float, pat_base: float, pat_valid: bool = True) -> float:
    d_spo2 = max(0.00, min(1.00, (spo2_base - spo2) / 5.0))
    if pat_valid and pat_base > 0:
        d_pat = max(0.00, min(1.00, (pat - pat_base) / 40.0))
        return 0.70 * d_spo2 + 0.30 * d_pat
    return d_spo2

def calculate_trend_momentum(history_5min: list[float]) -> float:
    if not history_5min or len(history_5min) < 3:
        return 0.0
    n = len(history_5min)
    x = np.arange(n)
    y = np.array(history_5min)
    x_mean = np.mean(x)
    y_mean = np.mean(y)
    denom = np.sum((x - x_mean) ** 2)
    if denom < 1e-9:
        return 0.0
    slope = np.sum((x - x_mean) * (y - y_mean)) / denom
    return float(max(-0.15, min(0.15, slope * 300.0)))

class E2EBaselineTracker:
    def __init__(self, init_time_s: float = 600.0, alpha: float = 0.02):
        self.init_time_s = init_time_s
        self.alpha = alpha
        self.hr_base = 70.0
        self.rmssd_base = 40.0
        self.spo2_base = 98.0
        self.pat_base = 220.0
        self.established = False

    def update(self, elapsed_s: float, hr: float, rmssd: float, spo2: float, pat: float, state: str):
        if elapsed_s < self.init_time_s:
            self.established = False
            return
        self.established = True
        # Gated Anti-Drift: Lock if state is not Normal / Stable
        if state != "Normal / Stable":
            return
        self.hr_base = (1.0 - self.alpha) * self.hr_base + self.alpha * hr
        self.rmssd_base = (1.0 - self.alpha) * self.rmssd_base + self.alpha * rmssd
        self.spo2_base = (1.0 - self.alpha) * self.spo2_base + self.alpha * spo2
        if pat > 0:
            self.pat_base = (1.0 - self.alpha) * self.pat_base + self.alpha * pat

def calculate_e2e_isi(
    p_model: float,
    hr: float,
    rmssd: float,
    spo2: float,
    pat: float,
    q_ppg: float,
    q_ecg: float,
    motion: float,
    elapsed_s: float,
    baseline: E2EBaselineTracker,
    history_5min: list[float],
    pat_valid: bool = True
) -> dict:
    q_overall = 0.40 * q_ppg + 0.35 * q_ecg + 0.25 * max(0.0, 1.0 - motion)
    
    # Model Evidence
    e_model = calculate_model_evidence(p_model)
    model_alert = p_model >= FROZEN_THRESHOLD
    
    # Check baseline status
    if elapsed_s < 600.0:
        state = "Baseline Establishing"
    elif q_overall < 0.35:
        state = "Insufficient Signal Quality"
    elif model_alert:
        state = "Elevated Model Evidence"
    else:
        state = "Normal / Stable"
        
    d_auto = calculate_autonomic_strain(hr, baseline.hr_base, rmssd, baseline.rmssd_base)
    d_perf = calculate_perfusion_strain(spo2, baseline.spo2_base, pat, baseline.pat_base, pat_valid)
    m_trend = calculate_trend_momentum(history_5min)
    
    isi_raw = 40.0 + (0.45 * (e_model - 0.20) + 0.30 * d_auto + 0.25 * d_perf + m_trend) * 60.0
    isi_clamped = max(0.0, min(100.0, isi_raw))
    
    if state == "Normal / Stable" and isi_clamped >= 60.0:
        state = "Elevated ISI Trend"
        
    # Baseline update respects anti-drift rule
    baseline.update(elapsed_s, hr, rmssd, spo2, pat, state)
    
    return {
        "isi_score": round(isi_clamped, 2),
        "product_state": state,
        "model_probability": p_model,
        "model_alert_state": model_alert,
        "model_evidence": round(e_model, 4),
        "autonomic_strain": round(d_auto, 4),
        "perfusion_strain": round(d_perf, 4),
        "trend_momentum": round(m_trend, 4),
        "q_overall": round(q_overall, 4)
    }


from tests.test_inference import get_sample_valid_features

class TestPhase10EndToEndValidation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = BeatAheadInferenceEngine()
        cls.schema = cls.engine.schema
        cls.feature_specs = cls.engine.feature_specs

    def _get_valid_feature_dict(self, st_shift=0.0):
        feat = get_sample_valid_features()
        if st_shift != 0.0:
            for k in feat:
                if "st_" in k:
                    feat[k] = float(st_shift)
        return feat

    # =========================================================================
    # TASK 1: COMPLETE PIPELINE TRACE
    # =========================================================================
    def test_task1_complete_pipeline_trace(self):
        """Trace a complete physiological cycle end-to-end."""
        features = self._get_valid_feature_dict(st_shift=0.0)
        
        # 1. Verification of canonical names and ordering
        feat_names = list(features.keys())
        schema_names = self.engine.feature_order
        self.assertEqual(feat_names, schema_names)
        self.assertEqual(len(feat_names), 26)

        # 2. ML Inference execution
        ml_resp = self.engine.predict(features)
        p_model = float(ml_resp["model_probability"])
        alert = bool(ml_resp["binary_early_warning"] == 1)
        self.assertIsInstance(p_model, float)
        self.assertFalse(alert)
        self.assertEqual(float(ml_resp["decision_threshold"]), FROZEN_THRESHOLD)

        # 3. Product Layer Pipeline Trace
        baseline = E2EBaselineTracker()
        history_5min = [35.0, 35.1, 35.0, 35.2]
        isi_out = calculate_e2e_isi(
            p_model=p_model,
            hr=72.0,
            rmssd=38.0,
            spo2=98.0,
            pat=220.0,
            q_ppg=0.95,
            q_ecg=0.92,
            motion=0.04,
            elapsed_s=800.0,
            baseline=baseline,
            history_5min=history_5min
        )

        # Invariants:
        # - Probability preserved
        self.assertEqual(isi_out["model_probability"], p_model)
        # - ISI is NOT p * 100
        self.assertNotAlmostEqual(isi_out["isi_score"], p_model * 100.0, places=1)
        # - Model state and ISI state separate
        self.assertEqual(isi_out["model_alert_state"], False)
        self.assertEqual(isi_out["product_state"], "Normal / Stable")
        self.assertTrue(0.0 <= isi_out["isi_score"] <= 100.0)

    # =========================================================================
    # TASK 2: FIVE END-TO-END SCENARIOS
    # =========================================================================
    def test_task2_scenario_a_normal_stable(self):
        """Scenario A: Normal / Stable (sub-threshold, good quality, stable baseline)."""
        baseline = E2EBaselineTracker()
        out = calculate_e2e_isi(
            p_model=0.02,
            hr=70.0,
            rmssd=40.0,
            spo2=98.0,
            pat=220.0,
            q_ppg=0.92,
            q_ecg=0.90,
            motion=0.05,
            elapsed_s=900.0,
            baseline=baseline,
            history_5min=[35.0, 35.1, 35.0]
        )
        self.assertEqual(out["product_state"], "Normal / Stable")
        self.assertFalse(out["model_alert_state"])
        self.assertLess(out["isi_score"], 50.0)
        self.assertGreaterEqual(out["q_overall"], 0.85)

    def test_task2_scenario_b_elevated_model_evidence(self):
        """Scenario B: Elevated Model Evidence (p >= 0.156742)."""
        baseline = E2EBaselineTracker()
        out = calculate_e2e_isi(
            p_model=0.25,
            hr=72.0,
            rmssd=38.0,
            spo2=97.0,
            pat=222.0,
            q_ppg=0.90,
            q_ecg=0.88,
            motion=0.06,
            elapsed_s=900.0,
            baseline=baseline,
            history_5min=[35.0, 36.0, 37.0]
        )
        self.assertTrue(out["model_alert_state"])
        self.assertEqual(out["product_state"], "Elevated Model Evidence")
        self.assertGreaterEqual(out["model_evidence"], 0.50)

    def test_task2_scenario_c_elevated_trend(self):
        """Scenario C: Elevated Trend (increasing physiological trajectory reaching ISI >= 60)."""
        baseline = E2EBaselineTracker()
        # High autonomic and perfusion strain + positive slope
        out = calculate_e2e_isi(
            p_model=0.10, # sub-threshold model
            hr=95.0,      # +25 bpm over baseline
            rmssd=12.0,   # -70% RMSSD drop
            spo2=93.0,    # -5% SpO2 drop
            pat=260.0,    # +40ms PAT elongation
            q_ppg=0.90,
            q_ecg=0.88,
            motion=0.05,
            elapsed_s=1000.0,
            baseline=baseline,
            history_5min=[40.0, 48.0, 56.0, 64.0] # rising trend
        )
        self.assertFalse(out["model_alert_state"]) # ML model is sub-threshold
        self.assertGreaterEqual(out["isi_score"], 60.0)
        self.assertEqual(out["product_state"], "Elevated ISI Trend")

    def test_task2_scenario_d_insufficient_signal(self):
        """Scenario D: Insufficient Signal (Q_overall < 0.35)."""
        baseline = E2EBaselineTracker()
        out = calculate_e2e_isi(
            p_model=0.50, # Even if model output is high
            hr=70.0,
            rmssd=40.0,
            spo2=98.0,
            pat=220.0,
            q_ppg=0.20,
            q_ecg=0.20,
            motion=0.80, # High motion
            elapsed_s=1200.0,
            baseline=baseline,
            history_5min=[35.0, 35.0]
        )
        self.assertLess(out["q_overall"], 0.35)
        self.assertEqual(out["product_state"], "Insufficient Signal Quality")

    def test_task2_scenario_e_baseline_establishing(self):
        """Scenario E: Baseline Establishing (t < 600s)."""
        baseline = E2EBaselineTracker()
        out = calculate_e2e_isi(
            p_model=0.05,
            hr=70.0,
            rmssd=40.0,
            spo2=98.0,
            pat=220.0,
            q_ppg=0.95,
            q_ecg=0.95,
            motion=0.02,
            elapsed_s=300.0, # only 5 minutes elapsed
            baseline=baseline,
            history_5min=[35.0]
        )
        self.assertEqual(out["product_state"], "Baseline Establishing")
        self.assertFalse(baseline.established)

    # =========================================================================
    # TASK 3: THRESHOLD BOUNDARY TESTS
    # =========================================================================
    def test_task3_threshold_boundary_continuity_and_sharp_state(self):
        """Test p = 0.156741, 0.156742, 0.156743 for continuity and state transition."""
        p_sub = 0.156741
        p_eq  = 0.156742
        p_post = 0.156743
        
        e_sub = calculate_model_evidence(p_sub)
        e_eq = calculate_model_evidence(p_eq)
        e_post = calculate_model_evidence(p_post)
        
        # 1. Exact midpoint check
        self.assertAlmostEqual(e_eq, 0.500000, places=5)
        
        # 2. Strict monotonicity
        self.assertLess(e_sub, e_eq)
        self.assertLess(e_eq, e_post)
        
        # 3. No numerical discontinuity (|e_sub - e_eq| < 1e-4)
        self.assertLess(abs(e_eq - e_sub), 1e-4)
        self.assertLess(abs(e_post - e_eq), 1e-4)
        
        # 4. Discrete model state boundary
        baseline = E2EBaselineTracker()
        res_sub = calculate_e2e_isi(p_sub, 70, 40, 98, 220, 0.9, 0.9, 0.05, 800, baseline, [])
        res_eq  = calculate_e2e_isi(p_eq, 70, 40, 98, 220, 0.9, 0.9, 0.05, 800, baseline, [])
        res_post = calculate_e2e_isi(p_post, 70, 40, 98, 220, 0.9, 0.9, 0.05, 800, baseline, [])
        
        self.assertFalse(res_sub["model_alert_state"])
        self.assertEqual(res_sub["product_state"], "Normal / Stable")
        
        self.assertTrue(res_eq["model_alert_state"])
        self.assertEqual(res_eq["product_state"], "Elevated Model Evidence")
        
        self.assertTrue(res_post["model_alert_state"])
        self.assertEqual(res_post["product_state"], "Elevated Model Evidence")

    # =========================================================================
    # TASK 4: DATA QUALITY FAILURES & DEGRADED MODES
    # =========================================================================
    def test_task4_degraded_sensor_modes(self):
        """Verify robust degraded-sensor behavior without crashes."""
        baseline = E2EBaselineTracker()
        
        # 1. Invalid PAT flag
        res_pat = calculate_e2e_isi(0.05, 70, 40, 98, 0.0, 0.9, 0.9, 0.05, 800, baseline, [], pat_valid=False)
        self.assertFalse(math.isnan(res_pat["isi_score"]))
        self.assertEqual(res_pat["perfusion_strain"], 0.0)
        
        # 2. High motion artifact coupled with degraded signal quality triggers Insufficient Signal
        res_motion = calculate_e2e_isi(0.05, 70, 40, 98, 220, 0.25, 0.25, 0.85, 800, baseline, [])
        self.assertLess(res_motion["q_overall"], 0.35)
        self.assertEqual(res_motion["product_state"], "Insufficient Signal Quality")
        
        # 3. All sensors degraded (zero quality)
        res_all_fail = calculate_e2e_isi(0.05, 70, 40, 98, 220, 0.0, 0.0, 1.0, 800, baseline, [])
        self.assertEqual(res_all_fail["q_overall"], 0.0)
        self.assertEqual(res_all_fail["product_state"], "Insufficient Signal Quality")
        self.assertFalse(math.isnan(res_all_fail["isi_score"]))

    # =========================================================================
    # TASK 5: API FAILURE MODES
    # =========================================================================
    def test_task5_api_error_rejection_and_fail_safe(self):
        """Verify strict error rejection for invalid inputs."""
        # 1. Missing feature
        bad_feats = self._get_valid_feature_dict()
        del bad_feats["st_obs_median"]
        with self.assertRaises(FeatureValidationError):
            self.engine.predict(bad_feats)
            
        # 2. NaN value
        nan_feats = self._get_valid_feature_dict()
        nan_feats["st_obs_median"] = float("nan")
        with self.assertRaises(FeatureValidationError):
            self.engine.predict(nan_feats)
            
        # 3. Out-of-bounds physiological value
        oob_feats = self._get_valid_feature_dict()
        oob_feats["hr_obs_mean"] = 450.0 # Impossible human heart rate
        with self.assertRaises(FeatureValidationError):
            self.engine.predict(oob_feats)

    # =========================================================================
    # TASK 9: STATE TRANSITIONS & ANTI-DRIFT DYNAMICS
    # =========================================================================
    def test_task9_state_transitions_and_anti_drift_dynamics(self):
        """Simulate dynamic trajectory and verify anti-drift locking."""
        baseline = E2EBaselineTracker()
        
        # Phase 1: 0 to 500s -> Baseline Establishing
        for t in range(0, 500, 100):
            res = calculate_e2e_isi(0.01, 70, 40, 98, 220, 0.9, 0.9, 0.05, float(t), baseline, [])
            self.assertEqual(res["product_state"], "Baseline Establishing")
            
        # Phase 2: 700s to 1200s -> Normal / Stable, Baseline adapts
        for t in range(700, 1200, 100):
            res = calculate_e2e_isi(0.01, 75.0, 40, 98, 220, 0.9, 0.9, 0.05, float(t), baseline, [])
            self.assertEqual(res["product_state"], "Normal / Stable")
            
        adapted_hr_base = baseline.hr_base
        self.assertGreater(adapted_hr_base, 70.0) # Confirmed adaptation occurred
        
        # Phase 3: Stress Episode (Elevated Model Evidence)
        # Baseline must FREEZE (Anti-Drift Lock)
        for t in range(1300, 2000, 100):
            res = calculate_e2e_isi(0.30, 110.0, 15, 94, 250, 0.9, 0.9, 0.05, float(t), baseline, [])
            self.assertEqual(res["product_state"], "Elevated Model Evidence")
            self.assertEqual(baseline.hr_base, adapted_hr_base) # Zero drift!
            
        # Phase 4: Insufficient Signal Quality interruption
        res_bad_sig = calculate_e2e_isi(0.01, 75, 40, 98, 220, 0.1, 0.1, 0.9, 2100.0, baseline, [])
        self.assertEqual(res_bad_sig["product_state"], "Insufficient Signal Quality")
        
        # Phase 5: Recovery back to Normal / Stable
        res_rec = calculate_e2e_isi(0.01, 75, 40, 98, 220, 0.9, 0.9, 0.05, 2200.0, baseline, [])
        self.assertEqual(res_rec["product_state"], "Normal / Stable")

if __name__ == "__main__":
    unittest.main()

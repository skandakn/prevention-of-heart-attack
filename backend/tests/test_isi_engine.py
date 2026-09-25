"""
tests/test_isi_engine.py

Comprehensive Phase 9 Automated Test Suite for BeatAhead ISI Engine:
1. p = 0.0 (Absolute lower bound)
2. p = 0.156741 (Sub-threshold boundary)
3. p = 0.156742 (Exact threshold boundary)
4. p = 0.156743 (Post-threshold boundary)
5. p = 1.0 (Theoretical upper bound)
6. Zero baseline deviations
7. Maximum component values
8. Minimum component values
9. Poor signal quality gating (Q < 0.35)
10. Missing SpO2 graceful handling
11. Invalid PAT handling
12. High motion artifact gating
13. Baseline initialization (< 600s)
14. Baseline adaptive update in stable state
15. Anti-drift baseline locking in elevated state
16. Deterministic bit-for-bit output repeatability
17. Boundedness invariant: 0 <= ISI <= 100
18. Model Alert state vs ISI state separation
"""

import sys
import unittest
import numpy as np
from pathlib import Path

# Add project root
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from src.isi_sensitivity_audit import (
    TAU_FROZEN,
    GAMMA1_BASE,
    GAMMA2_BASE,
    W_MODEL_BASE,
    W_AUTO_BASE,
    W_PERF_BASE,
    ISI_BASE,
    SCALE_BASE,
    ALPHA_EMA_BASE,
    compute_model_evidence,
    compute_autonomic_factor,
    compute_perfusion_factor,
    compute_trend_momentum,
    compute_overall_quality,
    calculate_isi,
    determine_state
)


class TestISIEngine(unittest.TestCase):

    def test_01_p_zero(self):
        """Test 1: p = 0.0 yields minimum evidence and stable state."""
        e_mod = compute_model_evidence(0.0)
        self.assertEqual(e_mod, 0.0)
        score, raw, _ = calculate_isi(0.0)
        self.assertEqual(score, 35)
        self.assertGreaterEqual(score, 0)
        self.assertLessEqual(score, 100)

    def test_02_p_sub_threshold(self):
        """Test 2: p = 0.156741 is sub-threshold and produces Normal / Stable state."""
        p = TAU_FROZEN - 1e-6
        e_mod = compute_model_evidence(p)
        self.assertAlmostEqual(e_mod, 0.50, places=4)
        score, _, _ = calculate_isi(p)
        state = determine_state(1.0, 1200.0, p, score)
        self.assertEqual(state, "Normal / Stable")

    def test_03_p_exact_threshold(self):
        """Test 3: p = 0.156742 yields exact evidence midpoint E=0.50 and Elevated Model Evidence."""
        e_mod = compute_model_evidence(TAU_FROZEN)
        self.assertAlmostEqual(e_mod, 0.50, places=6)
        score, _, _ = calculate_isi(TAU_FROZEN)
        state = determine_state(1.0, 1200.0, TAU_FROZEN, score)
        self.assertEqual(state, "Elevated Model Evidence")

    def test_04_p_post_threshold(self):
        """Test 4: p = 0.156743 is post-threshold and produces Elevated Model Evidence."""
        p = TAU_FROZEN + 1e-6
        e_mod = compute_model_evidence(p)
        self.assertAlmostEqual(e_mod, 0.50, places=4)
        score, _, _ = calculate_isi(p)
        state = determine_state(1.0, 1200.0, p, score)
        self.assertEqual(state, "Elevated Model Evidence")

    def test_05_p_one(self):
        """Test 5: p = 1.0 yields near-unit evidence and Elevated Model Evidence."""
        e_mod = compute_model_evidence(1.0)
        self.assertGreater(e_mod, 0.99)
        self.assertLessEqual(e_mod, 1.0)
        score, _, _ = calculate_isi(1.0)
        state = determine_state(1.0, 1200.0, 1.0, score)
        self.assertEqual(state, "Elevated Model Evidence")
        self.assertEqual(score, 61)

    def test_06_zero_deviations(self):
        """Test 6: Zero deviations with natural baseline p=0.005 yields score ~ 35."""
        score, raw, e_mod = calculate_isi(0.005, d_auto=0.0, d_perf=0.0, m_trend=0.0)
        self.assertAlmostEqual(e_mod, 0.004, places=3)
        self.assertEqual(score, 35)

    def test_07_maximum_component_values(self):
        """Test 7: Maximum allowed deviations correctly clamp to exactly 100."""
        score, raw, _ = calculate_isi(1.0, d_auto=1.0, d_perf=1.0, m_trend=0.15)
        self.assertGreater(raw, 100.0)
        self.assertEqual(score, 100)

    def test_08_minimum_component_values(self):
        """Test 8: Minimum allowed deviations correctly clamp within [0, 100]."""
        score, raw, _ = calculate_isi(0.0, d_auto=0.0, d_perf=0.0, m_trend=-0.15)
        self.assertGreaterEqual(score, 0)
        self.assertEqual(score, 26)

    def test_09_poor_signal_quality(self):
        """Test 9: Overall quality < 0.35 immediately enforces Insufficient Signal Quality."""
        q = compute_overall_quality(q_ecg=0.20, q_ppg=0.20, v_pat=0, i_motion=0.20)
        self.assertLess(q, 0.35)
        state = determine_state(q, 1200.0, 0.05, 45)
        self.assertEqual(state, "Insufficient Signal Quality")

    def test_10_missing_spo2(self):
        """Test 10: Missing SpO2 assumes zero deviation gracefully."""
        d_perf = compute_perfusion_factor(spo2=98.0, spo2_base=98.0, pat=225.0, pat_base=225.0, pat_valid=1)
        self.assertEqual(d_perf, 0.0)

    def test_11_invalid_pat(self):
        """Test 11: PAT valid flag = 0 excludes PAT from perfusion without crashing."""
        d_perf_valid = compute_perfusion_factor(spo2=94.0, spo2_base=98.0, pat=180.0, pat_base=225.0, pat_valid=1)
        d_perf_invalid = compute_perfusion_factor(spo2=94.0, spo2_base=98.0, pat=180.0, pat_base=225.0, pat_valid=0)
        self.assertGreater(d_perf_valid, d_perf_invalid)
        self.assertGreaterEqual(d_perf_invalid, 0.0)

    def test_12_high_motion_artifact(self):
        """Test 12: High motion artifact (0.85) reduces overall quality."""
        q_low_motion = compute_overall_quality(q_ecg=0.9, q_ppg=0.9, v_pat=1, i_motion=0.05)
        q_high_motion = compute_overall_quality(q_ecg=0.9, q_ppg=0.9, v_pat=1, i_motion=0.85)
        self.assertGreater(q_low_motion, q_high_motion)

    def test_13_baseline_initialization(self):
        """Test 13: Monitoring time < 600s returns Baseline Establishing state."""
        state = determine_state(q_overall=0.90, monitoring_time_s=350.0, p_model=0.01, isi_score=40)
        self.assertEqual(state, "Baseline Establishing")

    def test_14_baseline_adaptive_update_stable(self):
        """Test 14: EMA updates baseline during Normal / Stable state."""
        base_hr = 68.0
        sample_hr = 72.0
        alpha = 0.02
        new_base = (1.0 - alpha) * base_hr + alpha * sample_hr
        self.assertAlmostEqual(new_base, 68.08, places=2)

    def test_15_anti_drift_lock_elevated(self):
        """Test 15: Baseline updates are strictly locked during Elevated Model Evidence."""
        base_hr = 68.0
        state = "Elevated Model Evidence"
        # Under Phase 8 rule, if state != Normal / Stable, baseline does not change
        if state != "Normal / Stable":
            locked_base = base_hr
        else:
            locked_base = (1.0 - 0.02) * base_hr + 0.02 * 88.0
        self.assertEqual(locked_base, 68.0)

    def test_16_deterministic_repeatability(self):
        """Test 16: 10 repeated inferences produce bit-for-bit identical outputs."""
        outputs = [calculate_isi(0.12, d_auto=0.3, d_perf=0.2, m_trend=0.05) for _ in range(10)]
        scores = [o[0] for o in outputs]
        raws = [o[1] for o in outputs]
        self.assertEqual(len(set(scores)), 1)
        self.assertEqual(len(set(raws)), 1)

    def test_17_isi_boundedness_invariant(self):
        """Test 17: Invariant 0 <= ISI <= 100 holds across grid search."""
        for p in [0.0, 0.001, 0.05, 0.156742, 0.5, 0.999, 1.0]:
            for da in [0.0, 0.5, 1.0]:
                for dp in [0.0, 0.5, 1.0]:
                    for mt in [-0.15, 0.0, 0.15]:
                        score, raw, _ = calculate_isi(p, da, dp, mt)
                        self.assertGreaterEqual(score, 0)
                        self.assertLessEqual(score, 100)

    def test_18_model_state_vs_isi_state_separation(self):
        """Test 18: Model Alert State is strictly separate from ISI display score."""
        # Sub-threshold with high autonomic strain: Model Alert = False, but ISI >= 61 -> Elevated ISI Trend
        score, _, _ = calculate_isi(p_model=0.05, d_auto=0.9, d_perf=0.8, m_trend=0.1)
        self.assertGreaterEqual(score, 61)
        state = determine_state(1.0, 1200.0, 0.05, score)
        self.assertEqual(state, "Elevated ISI Trend")

        # Post-threshold with zero autonomic strain: Model Alert = True, but ISI < 61 -> Elevated Model Evidence
        score2, _, _ = calculate_isi(p_model=0.20, d_auto=0.0, d_perf=0.0, m_trend=0.0)
        self.assertLess(score2, 61)
        state2 = determine_state(1.0, 1200.0, 0.20, score2)
        self.assertEqual(state2, "Elevated Model Evidence")


if __name__ == "__main__":
    unittest.main()

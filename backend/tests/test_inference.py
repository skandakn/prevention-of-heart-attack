"""
tests/test_inference.py

Comprehensive independent inference test suite for BeatAhead Phase 5 Model Freeze:
1. Valid feature vector
2. Missing required feature
3. Extra unexpected feature
4. NaN value rejection
5. Infinity value rejection
6. Wrong data type rejection
7. Deterministic repeated inference (bit-for-bit equality)
8. Feature-order invariance for dictionary/named inputs
9. Decision threshold behavior (probability >= threshold -> 1, else 0)
10. Clean process loading & artifact integrity
11. Physiological bounds validation
"""

import sys
import copy
import math
import random
import unittest
import numpy as np
from pathlib import Path

# Add project root
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from src.inference import BeatAheadInferenceEngine, FeatureValidationError, predict_single_window


def get_sample_valid_features() -> dict:
    """Returns a realistic, valid physiological feature vector."""
    return {
        "ecg_hr_mean": 75.4,
        "ecg_hr_std": 6.8,
        "ecg_rr_sdnn": 55.2,
        "ecg_rr_rmssd": 42.1,
        "ecg_pnn50": 8.5,
        "ecg_r_amp_mv": 0.85,
        "ecg_qrs_width_ms": 95.0,
        "ecg_sqi": 0.98,
        "pat_median_ms": 220.0,
        "pat_iqr_ms": 45.0,
        "pat_valid_fraction": 0.85,
        "pat_valid": 1,
        "ppg_pulse_amp": 32.5,
        "ppg_perfusion_index": 85.0,
        "ppg_crest_time_ms": 110.0,
        "ppg_sqi": 1.0,
        "spo2_mean": 99.5,
        "spo2_min": 98.0,
        "spo2_std": 0.4,
        "spo2_desat_count": 0,
        "st_obs_mean": 0.12,
        "st_obs_median": 0.10,
        "st_obs_min": -0.05,
        "st_obs_std": 0.08,
        "st_delta_baseline": -0.02,
        "st_slope_mm_min": 0.001
    }


def get_sample_ischemic_features() -> dict:
    """Returns a feature vector with pre-event ischemic ST sagging."""
    feats = get_sample_valid_features()
    feats.update({
        "st_obs_mean": -0.75,
        "st_obs_median": -0.82,
        "st_obs_min": -1.15,
        "st_obs_std": 0.22,
        "st_delta_baseline": -0.65,
        "st_slope_mm_min": -0.045
    })
    return feats


class TestBeatAheadInference(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.engine = BeatAheadInferenceEngine()

    def test_01_valid_feature_vector(self):
        """Test 1: Valid feature vector passes and returns full schema response."""
        sample = get_sample_valid_features()
        res = self.engine.predict(sample)

        self.assertIn("model_probability", res)
        self.assertIn("calibrated_probability", res)
        self.assertIn("decision_threshold", res)
        self.assertIn("binary_early_warning", res)
        self.assertIn("alert_status", res)
        self.assertIn("lead_time_minutes", res)
        self.assertIn("model_version", res)
        self.assertIn("feature_schema_version", res)

        self.assertIsInstance(res["model_probability"], float)
        self.assertTrue(0.0 <= res["model_probability"] <= 1.0)
        self.assertIn(res["binary_early_warning"], [0, 1])
        self.assertIn(res["alert_status"], ["ALERT", "NORMAL"])
        self.assertEqual(res["lead_time_minutes"], 5)
        self.assertEqual(res["decision_threshold"], 0.156742)

    def test_02_missing_feature_rejection(self):
        """Test 2: Missing required feature must raise FeatureValidationError."""
        sample = get_sample_valid_features()
        del sample["st_obs_mean"]

        with self.assertRaises(FeatureValidationError) as ctx:
            self.engine.predict(sample)
        self.assertIn("Missing required feature", str(ctx.exception))

    def test_03_extra_feature_rejection(self):
        """Test 3: Unexpected extra feature must raise FeatureValidationError."""
        sample = get_sample_valid_features()
        sample["future_st_value"] = -1.5

        with self.assertRaises(FeatureValidationError) as ctx:
            self.engine.predict(sample)
        self.assertIn("Unexpected extra feature", str(ctx.exception))

    def test_04_nan_value_rejection(self):
        """Test 4: NaN values in any feature must be strictly rejected."""
        sample = get_sample_valid_features()
        sample["pat_median_ms"] = float("nan")

        with self.assertRaises(FeatureValidationError) as ctx:
            self.engine.predict(sample)
        self.assertIn("contains NaN", str(ctx.exception))

    def test_05_infinity_value_rejection(self):
        """Test 5: Infinite values must be strictly rejected."""
        sample = get_sample_valid_features()
        sample["ppg_pulse_amp"] = float("inf")

        with self.assertRaises(FeatureValidationError) as ctx:
            self.engine.predict(sample)
        self.assertIn("infinite value", str(ctx.exception))

    def test_06_wrong_data_type_rejection(self):
        """Test 6: Non-numeric strings or None must raise FeatureValidationError."""
        sample = get_sample_valid_features()
        sample["ecg_hr_mean"] = "SEVENTY_FIVE"

        with self.assertRaises(FeatureValidationError) as ctx:
            self.engine.predict(sample)
        self.assertIn("invalid non-numeric type", str(ctx.exception))

        sample_none = get_sample_valid_features()
        sample_none["spo2_mean"] = None
        with self.assertRaises(FeatureValidationError) as ctx2:
            self.engine.predict(sample_none)
        self.assertIn("invalid non-numeric type", str(ctx2.exception))

    def test_07_deterministic_repeated_inference(self):
        """Test 7: Repeated inference on the identical vector must produce identical output."""
        sample = get_sample_valid_features()
        results = [self.engine.predict(sample) for _ in range(10)]

        first_prob = results[0]["model_probability"]
        first_alert = results[0]["binary_early_warning"]

        for idx, res in enumerate(results[1:], 2):
            self.assertEqual(res["model_probability"], first_prob, f"Discrepancy on run {idx}")
            self.assertEqual(res["binary_early_warning"], first_alert, f"Alert discrepancy on run {idx}")

    def test_08_feature_order_invariance_for_named_inputs(self):
        """Test 8: Shuffling dictionary keys must yield the exact same prediction."""
        sample = get_sample_valid_features()
        res_canonical = self.engine.predict(sample)

        # Shuffle dictionary insertion order
        keys = list(sample.keys())
        random.seed(12345)
        random.shuffle(keys)
        shuffled_sample = {k: sample[k] for k in keys}

        res_shuffled = self.engine.predict(shuffled_sample)
        self.assertEqual(res_canonical["model_probability"], res_shuffled["model_probability"])
        self.assertEqual(res_canonical["binary_early_warning"], res_shuffled["binary_early_warning"])

    def test_09_threshold_behavior(self):
        """Test 9: Verify exact threshold behavior (prob >= threshold -> 1, prob < threshold -> 0)."""
        thresh = self.engine.decision_threshold
        self.assertAlmostEqual(thresh, 0.156742, places=5)

        # Baseline resting sample has low probability (< threshold)
        res_baseline = self.engine.predict(get_sample_valid_features())
        if res_baseline["model_probability"] < thresh:
            self.assertEqual(res_baseline["binary_early_warning"], 0)
            self.assertEqual(res_baseline["alert_status"], "NORMAL")

        # Ischemic pre-event sample with sagging ST has elevated probability
        res_ischemic = self.engine.predict(get_sample_ischemic_features())
        if res_ischemic["model_probability"] >= thresh:
            self.assertEqual(res_ischemic["binary_early_warning"], 1)
            self.assertEqual(res_ischemic["alert_status"], "ALERT")

        # Verify binary mathematical consistency
        self.assertEqual(
            res_baseline["binary_early_warning"],
            1 if res_baseline["model_probability"] >= thresh else 0
        )
        self.assertEqual(
            res_ischemic["binary_early_warning"],
            1 if res_ischemic["model_probability"] >= thresh else 0
        )

    def test_10_clean_process_loading(self):
        """Test 10: Inference engine loads cleanly from disk with all expected attributes."""
        new_engine = BeatAheadInferenceEngine()
        self.assertEqual(new_engine.feature_count, 26)
        self.assertEqual(len(new_engine.feature_order), 26)
        self.assertEqual(new_engine.model_name, "beatahead_phase5_model")
        self.assertEqual(new_engine.model_version, "1.0.0")
        self.assertEqual(new_engine.schema_version, "1.0.0")

    def test_11_physiological_bounds_validation(self):
        """Test 11: Values outside physiological bounds must raise FeatureValidationError."""
        sample_high_hr = get_sample_valid_features()
        sample_high_hr["ecg_hr_mean"] = 450.0  # Max bound is 300 bpm

        with self.assertRaises(FeatureValidationError) as ctx:
            self.engine.predict(sample_high_hr)
        self.assertIn("out of physiological bounds", str(ctx.exception))

        sample_high_spo2 = get_sample_valid_features()
        sample_high_spo2["spo2_mean"] = 105.0  # Max bound is 100%
        with self.assertRaises(FeatureValidationError) as ctx2:
            self.engine.predict(sample_high_spo2)
        self.assertIn("out of physiological bounds", str(ctx2.exception))


if __name__ == "__main__":
    unittest.main(verbosity=2)

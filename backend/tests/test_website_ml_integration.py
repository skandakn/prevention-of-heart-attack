"""
tests/test_website_ml_integration.py

Phase 14 Critical Integration Test Suite (unittest):
Validates the complete end-to-end data flow:
Simulated physiological data
  ↓
26-feature Matrix A vector
  ↓
ML API (/predict & CLI runner)
  ↓
Frozen XGBoost probability (beatahead_phase5_model.joblib)
  ↓
Threshold comparison (0.156742)
  ↓
Phase 8/9 ISI engine (calculate_isi & determine_state)
  ↓
Deterministic dashboard-visible result
"""

import os
import sys
import json
import math
import subprocess
import unittest
import numpy as np

# Ensure project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.inference import BeatAheadInferenceEngine
from src.isi_sensitivity_audit import (
    calculate_isi,
    determine_state,
    compute_model_evidence,
    TAU_FROZEN,
)

# Deterministic normative test vector (simulated baseline)
DETERMINISTIC_NORMATIVE_VECTOR = {
    "ecg_hr_mean": 68.5,
    "ecg_hr_std": 4.2,
    "ecg_rr_sdnn": 48.0,
    "ecg_rr_rmssd": 36.0,
    "ecg_pnn50": 12.0,
    "ecg_r_amp_mv": 1.1,
    "ecg_qrs_width_ms": 88.0,
    "ecg_sqi": 0.96,
    "pat_median_ms": 220.0,
    "pat_iqr_ms": 18.0,
    "pat_valid_fraction": 0.92,
    "pat_valid": 1,
    "ppg_pulse_amp": 2400.0,
    "ppg_perfusion_index": 3.5,
    "ppg_crest_time_ms": 110.0,
    "ppg_sqi": 0.94,
    "spo2_mean": 98.2,
    "spo2_min": 97.0,
    "spo2_std": 0.5,
    "spo2_desat_count": 0,
    "st_obs_mean": 0.12,
    "st_obs_median": 0.10,
    "st_obs_min": -0.05,
    "st_obs_std": 0.15,
    "st_delta_baseline": 0.05,
    "st_slope_mm_min": 0.02
}

# Deterministic acute stress / ischemia test vector
DETERMINISTIC_ISCHEMIC_VECTOR = {
    "ecg_hr_mean": 94.0,
    "ecg_hr_std": 14.5,
    "ecg_rr_sdnn": 20.0,
    "ecg_rr_rmssd": 12.0,
    "ecg_pnn50": 2.0,
    "ecg_r_amp_mv": 0.82,
    "ecg_qrs_width_ms": 108.0,
    "ecg_sqi": 0.92,
    "pat_median_ms": 285.0,
    "pat_iqr_ms": 45.0,
    "pat_valid_fraction": 0.78,
    "pat_valid": 1,
    "ppg_pulse_amp": 950.0,
    "ppg_perfusion_index": 1.1,
    "ppg_crest_time_ms": 155.0,
    "ppg_sqi": 0.88,
    "spo2_mean": 93.5,
    "spo2_min": 88.0,
    "spo2_std": 3.2,
    "spo2_desat_count": 35,
    "st_obs_mean": -1.65,
    "st_obs_median": -1.72,
    "st_obs_min": -2.35,
    "st_obs_std": 0.42,
    "st_delta_baseline": -1.45,
    "st_slope_mm_min": -0.38
}


class TestWebsiteMLIntegration(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.engine = BeatAheadInferenceEngine()

    def test_01_frozen_threshold_invariant(self):
        """Verify operating threshold is exactly 0.156742."""
        res = self.engine.predict(DETERMINISTIC_NORMATIVE_VECTOR)
        self.assertAlmostEqual(res["decision_threshold"], 0.156742, places=6)
        self.assertAlmostEqual(TAU_FROZEN, 0.156742, places=6)

    def test_02_normative_pipeline_trace(self):
        """
        Trace normative simulated sample:
        Features -> XGBoost -> p_model < 0.156742 -> Normal state -> ISI ~40
        """
        res = self.engine.predict(DETERMINISTIC_NORMATIVE_VECTOR)
        prob = res["model_probability"]
        self.assertLess(prob, res["decision_threshold"])
        self.assertEqual(res["binary_early_warning"], 0)
        self.assertEqual(res["alert_status"], "NORMAL")

        isi_score, raw_isi, e_mod = calculate_isi(prob, d_auto=0.05, d_perf=0.05, m_trend=0.0)
        state = determine_state(0.95, 1200.0, prob, isi_score)

        self.assertEqual(state, "Normal / Stable")
        self.assertTrue(0 <= isi_score <= 50)
        self.assertLess(e_mod, 0.50)

    def test_03_ischemic_pipeline_trace(self):
        """
        Trace ischemic simulated sample:
        Features -> XGBoost -> p_model >= 0.156742 -> Elevated Model Evidence -> ISI > 60
        """
        res = self.engine.predict(DETERMINISTIC_ISCHEMIC_VECTOR)
        prob = res["model_probability"]
        self.assertGreaterEqual(prob, res["decision_threshold"])
        self.assertEqual(res["binary_early_warning"], 1)
        self.assertEqual(res["alert_status"], "ALERT")

        isi_score, raw_isi, e_mod = calculate_isi(prob, d_auto=0.35, d_perf=0.30, m_trend=0.10)
        state = determine_state(0.90, 1200.0, prob, isi_score)

        self.assertIn(state, ["Elevated Model Evidence", "Elevated ISI Trend"])
        self.assertGreaterEqual(isi_score, 55)
        self.assertGreaterEqual(e_mod, 0.50)

    def test_04_deterministic_repeatability(self):
        """Verify repeated evaluations return bit-for-bit identical probabilities."""
        p1 = self.engine.predict(DETERMINISTIC_NORMATIVE_VECTOR)["model_probability"]
        p2 = self.engine.predict(DETERMINISTIC_NORMATIVE_VECTOR)["model_probability"]
        self.assertEqual(p1, p2)

        p3 = self.engine.predict(DETERMINISTIC_ISCHEMIC_VECTOR)["model_probability"]
        p4 = self.engine.predict(DETERMINISTIC_ISCHEMIC_VECTOR)["model_probability"]
        self.assertEqual(p3, p4)

    def test_05_cli_runner_parity(self):
        """Verify CLI runner (python src/ml_service.py --cli) produces identical probability."""
        python_exe = sys.executable
        script_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src", "ml_service.py"))

        payload = json.dumps({"features": DETERMINISTIC_ISCHEMIC_VECTOR})
        proc = subprocess.run(
            [python_exe, script_path, "--cli"],
            input=payload,
            capture_output=True,
            text=True,
            timeout=5
        )
        self.assertEqual(proc.returncode, 0)
        cli_result = json.loads(proc.stdout)

        self.assertEqual(cli_result["status"], "success")
        self.assertAlmostEqual(cli_result["threshold"], 0.156742, places=6)
        self.assertEqual(cli_result["prediction"], 1)
        self.assertGreaterEqual(cli_result["probability"], 0.156742)

    def test_06_no_model_in_public_or_client_code(self):
        """Security audit: ensure no .joblib or model binary exists in C:\\ischemic\\public or client code."""
        frontend_dir = r"C:\ischemic"
        public_dir = os.path.join(frontend_dir, "public")
        src_dir = os.path.join(frontend_dir, "src")

        for root, dirs, files in os.walk(public_dir):
            for file in files:
                self.assertFalse(file.endswith((".joblib", ".pkl", ".pt", ".onnx", ".bin")), f"Model file found in public: {file}")

        for root, dirs, files in os.walk(src_dir):
            for file in files:
                self.assertFalse(file.endswith((".joblib", ".pkl", ".pt", ".onnx", ".bin")), f"Model file found in src: {file}")


if __name__ == "__main__":
    unittest.main()

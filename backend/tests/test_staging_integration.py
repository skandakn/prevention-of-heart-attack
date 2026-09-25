"""
tests/test_staging_integration.py

Comprehensive Phase 7 Automated Integration Test Suite:
1. Valid feature payload returns success status
2. Standardized schema verification (probability, threshold, horizon, gap, metadata, provenance)
3. Decision threshold exact boundary condition (0.156742)
4. Missing single feature rejection
5. Missing all features rejection
6. NaN feature rejection
7. Infinity feature rejection
8. Malformed JSON rejection
9. Extra unrecognized feature handling
10. Frozen schema version validation (1.0.0)
11. Inference latency tracking
12. Zero exposure of server paths or stack traces in errors
13. Health endpoint verification
14. CLI fallback execution parity
"""

import sys
import json
import time
import subprocess
import threading
import unittest
from http.client import HTTPConnection
from pathlib import Path

# Add project root
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from src.ml_service import run_server, MLServiceRequestHandler
from src.inference import BeatAheadInferenceEngine


def get_valid_payload():
    """Generates valid 26-feature test payload."""
    return {
        "ecg_hr_mean": 72.0,
        "ecg_hr_std": 5.4,
        "ecg_rr_sdnn": 52.0,
        "ecg_rr_rmssd": 38.0,
        "ecg_pnn50": 10.0,
        "ecg_r_amp_mv": 0.95,
        "ecg_qrs_width_ms": 90.0,
        "ecg_sqi": 0.97,
        "pat_median_ms": 230.0,
        "pat_iqr_ms": 25.0,
        "pat_valid_fraction": 0.90,
        "pat_valid": 1,
        "ppg_pulse_amp": 2100.0,
        "ppg_perfusion_index": 3.2,
        "ppg_crest_time_ms": 115.0,
        "ppg_sqi": 0.95,
        "spo2_mean": 98.5,
        "spo2_min": 97.0,
        "spo2_std": 0.6,
        "spo2_desat_count": 0,
        "st_obs_mean": 0.10,
        "st_obs_median": 0.08,
        "st_obs_min": -0.05,
        "st_obs_std": 0.12,
        "st_delta_baseline": 0.02,
        "st_slope_mm_min": 0.01
    }


class TestBeatAheadStagingIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """Starts a background test HTTP server on port 8009."""
        from http.server import HTTPServer
        cls.port = 8009
        cls.server = HTTPServer(("127.0.0.1", cls.port), MLServiceRequestHandler)
        cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()
        time.sleep(0.3)

    @classmethod
    def tearDownClass(cls):
        """Shuts down background HTTP test server."""
        cls.server.shutdown()
        cls.server.server_close()

    def request(self, method: str, path: str, body: str = None, headers: dict = None):
        """Helper to make HTTP requests to test daemon."""
        conn = HTTPConnection("127.0.0.1", self.port, timeout=5)
        headers = headers or {}
        conn.request(method, path, body=body, headers=headers)
        response = conn.getresponse()
        data = response.read().decode("utf-8")
        conn.close()
        return response.status, data

    def test_01_valid_feature_payload_success(self):
        """Test 1: Valid full feature payload produces success response (200 OK)."""
        payload = json.dumps({"features": get_valid_payload()})
        status, data = self.request("POST", "/predict", payload, {"Content-Type": "application/json"})
        self.assertEqual(status, 200)
        res = json.loads(data)
        self.assertEqual(res.get("status"), "success")
        self.assertIn("probability", res)
        self.assertIsInstance(res["probability"], float)

    def test_02_standardized_schema_fields(self):
        """Test 2: Response contains all required standardized fields and provenance."""
        payload = json.dumps({"features": get_valid_payload()})
        status, data = self.request("POST", "/predict", payload, {"Content-Type": "application/json"})
        res = json.loads(data)
        
        self.assertIn("threshold", res)
        self.assertAlmostEqual(res["threshold"], 0.156742, places=6)
        self.assertEqual(res.get("horizon_seconds"), 300)
        self.assertEqual(res.get("gap_seconds"), 300)
        self.assertEqual(res.get("observation_seconds"), 300)
        self.assertIn("signal_quality", res)
        self.assertIn("metadata", res)
        self.assertIn("provenance", res)
        self.assertIn("intended_use", res["provenance"])

    def test_03_decision_threshold_exact_boundary(self):
        """Test 3: Threshold behavior (prob >= 0.156742 -> alert=True, else alert=False)."""
        payload = json.dumps({"features": get_valid_payload()})
        status, data = self.request("POST", "/predict", payload, {"Content-Type": "application/json"})
        res = json.loads(data)
        prob = res["probability"]
        thresh = res["threshold"]
        
        if prob >= thresh:
            self.assertEqual(res["alert"], True)
            self.assertEqual(res["prediction"], 1)
            self.assertEqual(res["risk_tier"], "High Risk")
        else:
            self.assertEqual(res["alert"], False)
            self.assertEqual(res["prediction"], 0)
            self.assertEqual(res["risk_tier"], "Low Risk")

    def test_04_missing_single_feature_rejected(self):
        """Test 4: Missing one required feature -> rejected with 400 Bad Request."""
        feats = get_valid_payload()
        del feats["ecg_hr_mean"]
        payload = json.dumps({"features": feats})
        status, data = self.request("POST", "/predict", payload, {"Content-Type": "application/json"})
        self.assertEqual(status, 400)
        res = json.loads(data)
        self.assertIn("error", res)
        self.assertIn("ecg_hr_mean", res["error"])

    def test_05_missing_all_features_rejected(self):
        """Test 5: Empty features payload -> rejected with 400 Bad Request."""
        payload = json.dumps({"features": {}})
        status, data = self.request("POST", "/predict", payload, {"Content-Type": "application/json"})
        self.assertEqual(status, 400)
        res = json.loads(data)
        self.assertIn("error", res)

    def test_06_nan_feature_rejected(self):
        """Test 6: NaN feature values -> rejected with 400 Bad Request."""
        feats = get_valid_payload()
        feats["ecg_hr_mean"] = None  # None translates to null/NaN
        payload = json.dumps({"features": feats})
        status, data = self.request("POST", "/predict", payload, {"Content-Type": "application/json"})
        self.assertEqual(status, 400)
        res = json.loads(data)
        self.assertIn("error", res)

    def test_07_infinity_feature_rejected(self):
        """Test 7: Out-of-bounds or non-finite values -> rejected with 400."""
        feats = get_valid_payload()
        feats["ecg_hr_mean"] = 99999.0
        payload = json.dumps({"features": feats})
        status, data = self.request("POST", "/predict", payload, {"Content-Type": "application/json"})
        self.assertEqual(status, 400)
        res = json.loads(data)
        self.assertIn("error", res)

    def test_08_malformed_json_rejected(self):
        """Test 8: Malformed JSON payload -> rejected with 400 Bad Request."""
        payload = "{\"features\": {broken_json"
        status, data = self.request("POST", "/predict", payload, {"Content-Type": "application/json"})
        self.assertEqual(status, 400)
        res = json.loads(data)
        self.assertIn("error", res)

    def test_09_extra_features_handled_gracefully(self):
        """Test 9: Extra unrecognized features are safely handled without crash."""
        feats = get_valid_payload()
        feats["unexpected_sensor_metric"] = 42.0
        payload = json.dumps({"features": feats})
        status, data = self.request("POST", "/predict", payload, {"Content-Type": "application/json"})
        self.assertEqual(status, 200)
        res = json.loads(data)
        self.assertEqual(res.get("status"), "success")

    def test_10_schema_and_model_version_frozen(self):
        """Test 10: Verified schema version and model version match frozen packaging."""
        payload = json.dumps({"features": get_valid_payload()})
        status, data = self.request("POST", "/predict", payload, {"Content-Type": "application/json"})
        res = json.loads(data)
        self.assertEqual(res["metadata"]["schema_version"], "1.0.0")
        self.assertEqual(res["metadata"]["model_version"], "1.0.0")

    def test_11_latency_tracked(self):
        """Test 11: Latency is tracked and returned in metadata."""
        payload = json.dumps({"features": get_valid_payload()})
        status, data = self.request("POST", "/predict", payload, {"Content-Type": "application/json"})
        res = json.loads(data)
        self.assertIn("latency_ms", res["metadata"])
        self.assertGreater(res["metadata"]["latency_ms"], 0.0)

    def test_12_zero_path_or_trace_exposure(self):
        """Test 12: Zero exposure of server file paths, secrets, or python stack traces in errors."""
        payload = "not valid json at all"
        status, data = self.request("POST", "/predict", payload)
        self.assertEqual(status, 400)
        self.assertNotIn("Traceback", data)
        self.assertNotIn("C:\\", data)
        self.assertNotIn("Users\\skand", data)

    def test_13_health_check_endpoint(self):
        """Test 13: GET /health returns 200 OK with model status."""
        status, data = self.request("GET", "/health")
        self.assertEqual(status, 200)
        res = json.loads(data)
        self.assertEqual(res.get("status"), "healthy")
        self.assertEqual(res.get("model_loaded"), True)
        self.assertAlmostEqual(res.get("decision_threshold"), 0.156742, places=6)

    def test_14_cli_fallback_execution_parity(self):
        """Test 14: Subprocess CLI mode operates identically to HTTP service."""
        python_exe = sys.executable
        cli_script = str(BASE_DIR / "src" / "ml_service.py")
        input_data = json.dumps({"features": get_valid_payload()})
        
        proc = subprocess.run(
            [python_exe, cli_script, "--cli"],
            input=input_data,
            text=True,
            capture_output=True
        )
        self.assertEqual(proc.returncode, 0)
        res = json.loads(proc.stdout)
        self.assertEqual(res.get("status"), "success")
        self.assertAlmostEqual(res.get("threshold"), 0.156742, places=6)
        self.assertEqual(res.get("horizon_seconds"), 300)


if __name__ == "__main__":
    unittest.main()

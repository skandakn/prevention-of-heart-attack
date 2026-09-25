"""
src/ml_service.py

BeatAhead ML Backend Inference Service.
Provides a strict service boundary around the frozen Phase 5/6 model artifacts.
Runs on http://127.0.0.1:8000.

Endpoints:
- GET  /health   -> Health check and model metadata
- POST /predict  -> Run inference on Matrix A feature vector
"""

import os
import sys
import json
import time
import argparse
from http.server import HTTPServer, BaseHTTPRequestHandler

from socketserver import ThreadingMixIn
from pathlib import Path
from typing import Dict, Any, Optional

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from src.inference import BeatAheadInferenceEngine, FeatureValidationError

MODELS_DIR = BASE_DIR / "models"
MANIFEST_PATH = MODELS_DIR / "MODEL_MANIFEST.json"

# Load engine once at service startup
try:
    INFERENCE_ENGINE = BeatAheadInferenceEngine(MODELS_DIR)
except Exception as e:
    print(f"FATAL: Failed to initialize BeatAheadInferenceEngine: {e}", file=sys.stderr)
    INFERENCE_ENGINE = None


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    """Multi-threaded HTTP server for concurrent inference handling."""
    daemon_threads = True


class MLServiceRequestHandler(BaseHTTPRequestHandler):
    """Request handler for ML service boundary."""

    server_version = "BeatAhead-MLService/1.0"

    def _set_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(204)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path in ["/health", "/", "/api/health"]:
            if INFERENCE_ENGINE is None:
                self._send_json(503, {
                    "status": "unhealthy",
                    "error": "Model artifact failed to load"
                })
                return

            manifest_sha = None
            if MANIFEST_PATH.exists():
                try:
                    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
                        manifest = json.load(f)
                        manifest_sha = manifest["artifacts"]["beatahead_phase5_model.joblib"]["sha256"]
                except Exception:
                    pass

            self._send_json(200, {
                "status": "healthy",
                "service": "BeatAhead ML Inference Service",
                "model_loaded": True,
                "model_name": INFERENCE_ENGINE.model_name,
                "model_version": INFERENCE_ENGINE.model_version,
                "feature_schema_version": INFERENCE_ENGINE.schema_version,
                "decision_threshold": round(INFERENCE_ENGINE.decision_threshold, 6),
                "feature_count": INFERENCE_ENGINE.feature_count,
                "prediction_horizon_seconds": 300,
                "model_artifact_sha256": manifest_sha,
                "provenance": {
                    "cohort": "100-case VitalDB surgical cohort",
                    "validation": "80-case development / 20-case locked test",
                    "target": "prospective intraoperative ST-deviation event (>=60s at ST<=-1.0mm)",
                    "disclaimer": "Research prototype. Not clinically validated. Not a diagnostic system."
                }
            })
        else:
            self._send_json(404, {"error": "Endpoint not found"})

    def do_POST(self):
        if self.path not in ["/predict", "/api/ml/predict"]:
            self._send_json(404, {"error": "Endpoint not found"})
            return

        if INFERENCE_ENGINE is None:
            self._send_json(503, {"error": "ML inference service unavailable: Model artifact not loaded"})
            return

        # 1. Payload size check (max 64 KB to mitigate DoS)
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 65536:
            self._send_json(413, {"error": "Payload too large. Maximum size is 64 KB."})
            return

        # 2. Read and parse body
        try:
            raw_body = self.rfile.read(content_length).decode("utf-8")
            body = json.loads(raw_body)
        except json.JSONDecodeError:
            self._send_json(400, {"error": "Malformed JSON payload in request body."})
            return
        except Exception:
            self._send_json(400, {"error": "Invalid request encoding."})
            return

        # 3. Schema version verification
        schema_version = body.get("feature_schema_version")
        if schema_version and schema_version != INFERENCE_ENGINE.schema_version:
            self._send_json(400, {
                "error": f"Unsupported feature_schema_version '{schema_version}'. Expected '{INFERENCE_ENGINE.schema_version}'."
            })
            return

        # 4. Extract features
        if "features" in body and isinstance(body["features"], dict):
            features_dict = body["features"]
        else:
            # Direct flat dictionary excluding metadata keys
            features_dict = {k: v for k, v in body.items() if k not in ["feature_schema_version", "model_version"]}

        # Safely retain only recognized features if extraneous keys are supplied
        clean_features = {k: v for k, v in features_dict.items() if k in INFERENCE_ENGINE.feature_order}

        # 5. Run inference with strict validation and latency timing
        t0 = time.perf_counter()
        try:
            pred = INFERENCE_ENGINE.predict(clean_features)
            latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
            
            prob = float(pred["model_probability"])
            thresh = float(pred["decision_threshold"])
            alert = bool(pred["binary_early_warning"] == 1)
            risk_tier = "High Risk" if alert else "Low Risk"

            self._send_json(200, {
                "status": "success",
                "probability": prob,
                "prediction": 1 if alert else 0,
                "threshold": thresh,
                "alert": alert,
                "horizon_seconds": 300,
                "gap_seconds": 300,
                "observation_seconds": 300,
                "risk_tier": risk_tier,
                "signal_quality": {
                    "ecg_sqi": float(clean_features.get("ecg_sqi", 1.0)),
                    "ppg_sqi": float(clean_features.get("ppg_sqi", 1.0)),
                    "pat_valid": int(clean_features.get("pat_valid", 1))
                },
                "metadata": {
                    "model_version": pred["model_version"],
                    "schema_version": pred["feature_schema_version"],
                    "artifact_id": "XGBoost_Matrix_A_v1_frozen",
                    "training_cohort": "VitalDB 100-case frozen benchmark",
                    "latency_ms": latency_ms
                },
                "provenance": {
                    "pipeline": "Phase 6 deployment packaging",
                    "intended_use": "Local research and demonstration only",
                    "regulatory_status": "Non-diagnostic investigational tool. Not FDA cleared or approved for clinical diagnostic use."
                }
            })
        except FeatureValidationError as e:
            # Client-side validation failure (400 Bad Request)
            self._send_json(400, {"error": str(e)})
        except Exception:
            # Internal error: strictly sanitize to prevent leaking tracebacks or paths
            self._send_json(500, {"error": "Internal inference error. Please verify input schema."})


    def _send_json(self, status_code: int, data: Dict[str, Any]):
        response_bytes = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self._set_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.end_headers()
        self.wfile.write(response_bytes)

    def log_message(self, format, *args):
        # Concise logging to stdout
        sys.stdout.write(f"[ML-Service] {self.address_string()} - {format % args}\n")
        sys.stdout.flush()


def run_server(host: str = "127.0.0.1", port: int = 8000):
    server_address = (host, port)
    httpd = ThreadedHTTPServer(server_address, MLServiceRequestHandler)
    print(f"BeatAhead ML Service listening on http://{host}:{port}", flush=True)
    print("Press Ctrl+C to terminate.", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down ML Service...", flush=True)
        httpd.server_close()


def run_cli_inference(json_str: Optional[str] = None):
    """Executes single prediction via CLI for subprocess integration."""
    if INFERENCE_ENGINE is None:
        print(json.dumps({"error": "Model artifact not loaded", "status": "error"}), file=sys.stderr)
        sys.exit(1)

    try:
        if not json_str or json_str.strip() == "":
            json_str = sys.stdin.read()
        
        data = json.loads(json_str)
        features = data.get("features", data)
        pred = INFERENCE_ENGINE.predict(features)
        
        prob = float(pred["model_probability"])
        thresh = float(pred["decision_threshold"])
        alert = bool(pred["binary_early_warning"] == 1)
        
        output = {
            "status": "success",
            "model_version": pred["model_version"],
            "schema_version": pred["feature_schema_version"],
            "probability": prob,
            "prediction": 1 if alert else 0,
            "threshold": thresh,
            "alert": alert,
            "horizon_seconds": 300,
            "gap_seconds": 300,
            "observation_seconds": 300,
            "risk_tier": "High Risk" if alert else "Low Risk",
            "metadata": {
                "model_version": pred["model_version"],
                "schema_version": pred["feature_schema_version"],
                "artifact_id": "XGBoost_Matrix_A_v1_frozen",
                "training_cohort": "VitalDB 100-case frozen benchmark"
            }
        }
        print(json.dumps(output))
    except FeatureValidationError as e:
        print(json.dumps({"error": str(e), "status": "error"}), file=sys.stderr)
        sys.exit(2)
    except Exception as e:
        print(json.dumps({"error": "Internal inference error", "status": "error"}), file=sys.stderr)
        sys.exit(3)


if __name__ == "__main__":
    env_port = int(os.environ.get("PORT", 8000))
    env_host = os.environ.get("HOST", "127.0.0.1")
    parser = argparse.ArgumentParser(description="BeatAhead ML Inference Service")
    parser.add_argument("--host", default=env_host, help="Host address")
    parser.add_argument("--port", type=int, default=env_port, help="Port number")
    parser.add_argument("--cli", nargs="?", const="", default=None, help="Direct JSON string inference or read from stdin")
    args = parser.parse_args()

    if args.cli is not None:
        run_cli_inference(args.cli)
    else:
        run_server(host=args.host, port=args.port)



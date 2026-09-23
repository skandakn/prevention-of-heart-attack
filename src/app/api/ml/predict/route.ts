import { NextResponse } from "next/server";
import { execFileSync } from "child_process";
import path from "path";

// 26 Expected Matrix A Features
const EXPECTED_FEATURES = [
  "ecg_hr_mean",
  "ecg_hr_std",
  "ecg_rr_sdnn",
  "ecg_rr_rmssd",
  "ecg_pnn50",
  "ecg_r_amp_mv",
  "ecg_qrs_width_ms",
  "ecg_sqi",
  "pat_median_ms",
  "pat_iqr_ms",
  "pat_valid_fraction",
  "pat_valid",
  "ppg_pulse_amp",
  "ppg_perfusion_index",
  "ppg_crest_time_ms",
  "ppg_sqi",
  "spo2_mean",
  "spo2_min",
  "spo2_std",
  "spo2_desat_count",
  "st_obs_mean",
  "st_obs_median",
  "st_obs_min",
  "st_obs_std",
  "st_delta_baseline",
  "st_slope_mm_min"
] as const;

type FeatureName = typeof EXPECTED_FEATURES[number];


const FEATURE_BOUNDS: Record<string, [number, number]> = {
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

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";
const ML_WORKSPACE_DIR = "C:\\ML Model - Ischemic";
const PYTHON_PATH = path.join(ML_WORKSPACE_DIR, ".venv", "Scripts", "python.exe");
const ML_SERVICE_SCRIPT = path.join(ML_WORKSPACE_DIR, "src", "ml_service.py");

export async function GET() {
  // Health check endpoint
  try {
    const res = await fetch(`${ML_SERVICE_URL}/health`, {
      method: "GET",
      cache: "no-store",
      headers: { "Accept": "application/json" }
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({
        status: "healthy",
        mode: "http_daemon",
        service_data: data
      });
    }
  } catch {
    // If daemon is not running, CLI fallback is ready
  }

  return NextResponse.json({
    status: "healthy",
    mode: "cli_fallback_ready",
    threshold: 0.156742,
    model_version: "1.0.0-phase5-frozen",
    schema_version: "1.0.0"
  });
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  // Allow either { features: { ... } } or flat { ecg_hr_mean: ... }
  const features = body.features && typeof body.features === "object" ? body.features : body;

  if (!features || typeof features !== "object" || Array.isArray(features)) {
    return NextResponse.json(
      { error: "Payload must contain a valid features object" },
      { status: 400 }
    );
  }

  // 1. Check for missing features
  const missing = EXPECTED_FEATURES.filter(f => !(f in features) || features[f] === undefined || features[f] === null);
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: "Missing required features",
        missing_count: missing.length,
        missing_features: missing
      },
      { status: 400 }
    );
  }

  // 2. Validate types, NaNs, infinities, and bounds
  const validationErrors: string[] = [];
  const cleanFeatures: Record<string, number> = {};

  for (const feat of EXPECTED_FEATURES) {
    const val = features[feat];
    if (typeof val !== "number" || Number.isNaN(val) || !Number.isFinite(val)) {
      validationErrors.push(`Feature '${feat}' must be a finite number (got ${val})`);
      continue;
    }

    const bounds = FEATURE_BOUNDS[feat];
    if (bounds) {
      const [min, max] = bounds;
      if (val < min || val > max) {
        validationErrors.push(`Feature '${feat}' value ${val} out of bounds [${min}, ${max}]`);
      }
    }
    cleanFeatures[feat] = val;
  }

  if (validationErrors.length > 0) {
    return NextResponse.json(
      {
        error: "Feature validation failed",
        errors: validationErrors
      },
      { status: 400 }
    );
  }

  // 3. Attempt inference via HTTP Service
  let result: any = null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.ML_SERVICE_AUTH_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.ML_SERVICE_AUTH_TOKEN}`;
    }

    const res = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: "POST",
      headers,
      body: JSON.stringify({ features: cleanFeatures }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      result = await res.json();
    }
  } catch {
    // HTTP daemon unavailable or timed out; smoothly fall back to CLI runner
  }

  // 4. CLI Fallback if HTTP service didn't respond
  if (!result) {
    try {
      const inputJson = JSON.stringify({ features: cleanFeatures });
      const stdout = execFileSync(PYTHON_PATH, [ML_SERVICE_SCRIPT, "--cli"], {
        input: inputJson,
        encoding: "utf-8",
        timeout: 5000,
        windowsHide: true,
        maxBuffer: 1024 * 1024
      });
      result = JSON.parse(stdout);
    } catch (cliErr: any) {
      // Security: never return raw command outputs, file paths, or stack traces
      console.error("ML Inference CLI error:", cliErr?.message || "Unknown error");
      return NextResponse.json(
        {
          error: "Inference engine temporarily unavailable",
          code: "ML_SERVICE_ERROR"
        },
        { status: 503 }
      );
    }
  }

  // 5. Check if service returned error
  if (result.error || result.status !== "success") {
    return NextResponse.json(
      {
        error: result.error || "Inference failed",
        code: "INFERENCE_ERROR"
      },
      { status: 400 }
    );
  }

  // 6. Return sanitized standardized response
  return NextResponse.json({
    status: "success",
    probability: result.probability,
    prediction: result.prediction,
    threshold: result.threshold,
    horizon_seconds: result.horizon_seconds ?? 300,
    gap_seconds: result.gap_seconds ?? 300,
    observation_seconds: result.observation_seconds ?? 300,
    risk_tier: result.risk_tier ?? (result.probability >= 0.156742 ? "High Risk" : "Low Risk"),
    signal_quality: {
      ecg_sqi: cleanFeatures.ecg_sqi,
      ppg_sqi: cleanFeatures.ppg_sqi,
      pat_valid: cleanFeatures.pat_valid
    },
    metadata: {
      model_version: result.metadata?.model_version || "1.0.0-phase5-frozen",
      schema_version: result.metadata?.schema_version || "1.0.0",
      artifact_id: result.metadata?.artifact_id || "XGBoost_Matrix_A_v1_frozen",
      training_cohort: "VitalDB 100-case frozen benchmark",
      latency_ms: result.metadata?.latency_ms ?? 0
    },
    provenance: {
      pipeline: "Phase 6 deployment packaging",
      intended_use: "Local research and demonstration only",
      regulatory_status: "Non-diagnostic investigational tool. Not FDA cleared or approved for clinical diagnostic use."
    }
  });
}

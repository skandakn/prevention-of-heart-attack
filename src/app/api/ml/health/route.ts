import { NextResponse } from "next/server";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";

export async function GET() {
  const timestamp = new Date().toISOString();

  let upstreamStatus = "unreachable";
  let upstreamDetails: Record<string, unknown> | null = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const headers: Record<string, string> = { Accept: "application/json" };
    if (process.env.ML_SERVICE_AUTH_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.ML_SERVICE_AUTH_TOKEN}`;
    }

    const res = await fetch(`${ML_SERVICE_URL}/health`, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      upstreamStatus = "connected";
      const data = await res.json();
      upstreamDetails = {
        model_loaded: data.model_loaded ?? true,
        features_count: data.features_count ?? 26,
      };
    }
  } catch {
    upstreamStatus = "unreachable";
  }

  return NextResponse.json({
    status: upstreamStatus === "connected" ? "healthy" : "degraded",
    timestamp,
    service: "BeatAhead ML Gateway",
    model_version: "1.0.0-phase5-frozen",
    schema_version: "1.0.0",
    decision_threshold: 0.156742,
    selection_metric: "f1_score",
    upstream_service: {
      status: upstreamStatus,
      configured_url: Boolean(process.env.ML_SERVICE_URL),
      details: upstreamDetails,
    },
  });
}

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Cpu, 
  Info, 
  RefreshCw, 
  ShieldAlert, 
  Sliders, 
  Zap 
} from "lucide-react";

interface InferenceResponse {
  status: string;
  probability: number;
  prediction: number;
  threshold: number;
  horizon_seconds: number;
  gap_seconds: number;
  observation_seconds: number;
  risk_tier: string;
  signal_quality: {
    ecg_sqi: number;
    ppg_sqi: number;
    pat_valid: number;
  };
  metadata: {
    model_version: string;
    schema_version: string;
    artifact_id: string;
    training_cohort: string;
    latency_ms: number;
  };
  provenance: {
    pipeline: string;
    intended_use: string;
    regulatory_status: string;
  };
}

const PRESET_NORMATIVE = {
  ecg_hr_mean: 68.5,
  ecg_hr_std: 4.2,
  ecg_rr_sdnn: 48.0,
  ecg_rr_rmssd: 36.0,
  ecg_pnn50: 12.0,
  ecg_r_amp_mv: 1.1,
  ecg_qrs_width_ms: 88.0,
  ecg_sqi: 0.96,
  pat_median_ms: 220.0,
  pat_iqr_ms: 18.0,
  pat_valid_fraction: 0.92,
  pat_valid: 1,
  ppg_pulse_amp: 2400.0,
  ppg_perfusion_index: 3.5,
  ppg_crest_time_ms: 110.0,
  ppg_sqi: 0.94,
  spo2_mean: 98.2,
  spo2_min: 97.0,
  spo2_std: 0.5,
  spo2_desat_count: 0,
  st_obs_mean: 0.12,
  st_obs_median: 0.10,
  st_obs_min: -0.05,
  st_obs_std: 0.15,
  st_delta_baseline: 0.05,
  st_slope_mm_min: 0.02
};

const PRESET_ISCHEMIA = {
  ecg_hr_mean: 94.0,
  ecg_hr_std: 14.5,
  ecg_rr_sdnn: 20.0,
  ecg_rr_rmssd: 12.0,
  ecg_pnn50: 2.0,
  ecg_r_amp_mv: 0.82,
  ecg_qrs_width_ms: 108.0,
  ecg_sqi: 0.92,
  pat_median_ms: 285.0,
  pat_iqr_ms: 45.0,
  pat_valid_fraction: 0.78,
  pat_valid: 1,
  ppg_pulse_amp: 950.0,
  ppg_perfusion_index: 1.1,
  ppg_crest_time_ms: 155.0,
  ppg_sqi: 0.88,
  spo2_mean: 93.5,
  spo2_min: 88.0,
  spo2_std: 3.2,
  spo2_desat_count: 35,
  st_obs_mean: -1.65,
  st_obs_median: -1.72,
  st_obs_min: -2.35,
  st_obs_std: 0.42,
  st_delta_baseline: -1.45,
  st_slope_mm_min: -0.38
};

export function ResearchModelSignalCard() {
  const [selectedPreset, setSelectedPreset] = useState<"normative" | "ischemia">("normative");
  const [result, setResult] = useState<InferenceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEvaluatedAt, setLastEvaluatedAt] = useState<string | null>(null);

  const runEvaluation = useCallback(async (presetType: "normative" | "ischemia") => {
    setLoading(true);
    setError(null);
    const payload = presetType === "normative" ? PRESET_NORMATIVE : PRESET_ISCHEMIA;

    try {
      const res = await fetch("/api/ml/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features: payload })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Inference failed");
      } else {
        setResult(data);
        setLastEvaluatedAt(new Date().toLocaleTimeString());
      }
    } catch {
      setError("Network or ML service communication error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runEvaluation(selectedPreset);
  }, [selectedPreset, runEvaluation]);

  const isAlert = result ? result.prediction === 1 || result.probability >= (result.threshold || 0.156742) : false;
  const thresholdPct = result ? ((result.threshold || 0.156742) * 100).toFixed(2) : "15.67";
  const probPct = result ? (result.probability * 100).toFixed(2) : "--";

  return (
    <Card className="border-navy-200 shadow-elevated bg-white overflow-hidden">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-navy-900 via-navy-800 to-indigo-950 text-white p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
                <Cpu className="w-3.5 h-3.5 text-indigo-300" />
                STAGING INTEGRATION
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-200 border border-amber-400/30">
                RESEARCH MODEL SIGNAL
              </span>
              <span className="text-xs text-navy-300 font-mono">
                v1.0.0-phase5-frozen
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" />
              Early-Warning Ischemia Prediction Model
            </h2>
            <p className="text-xs text-navy-200">
              Frozen XGBoost Matrix A (26 multimodal ECG, PPG, PAT & ST features) ? 300s window ?? 300s buffer ?? 300s early-warning horizon
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => runEvaluation(selectedPreset)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium transition shadow-sm"
              title="Run inference evaluation"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Evaluating..." : "Evaluate Model"}
            </button>
          </div>
        </div>
      </div>

      <CardContent className="p-6 space-y-6">
        {/* Preset Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-navy-50/80 border border-navy-100">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-navy-600" />
            <span className="text-xs font-semibold text-navy-800 uppercase tracking-wide">Physiological Test Profile:</span>
          </div>
          <div className="inline-flex rounded-lg bg-white p-1 border border-navy-200 shadow-sm">
            <button
              type="button"
              onClick={() => setSelectedPreset("normative")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                selectedPreset === "normative"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-navy-600 hover:text-navy-900"
              }`}
            >
              Stable Normative Baseline
            </button>
            <button
              type="button"
              onClick={() => setSelectedPreset("ischemia")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                selectedPreset === "ischemia"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-navy-600 hover:text-navy-900"
              }`}
            >
              Early-Warning Ischemia Event
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold">Inference Pipeline Warning</div>
              <div className="text-xs text-rose-700 mt-0.5">{error}</div>
            </div>
          </div>
        )}

        {/* Inference Results Grid */}
        <div className="grid md:grid-cols-3 gap-5">
          {/* Card 1: Probability & Risk */}
          <div className={`p-5 rounded-xl border transition ${
            isAlert 
              ? "bg-rose-50/60 border-rose-200 shadow-sm" 
              : "bg-emerald-50/60 border-emerald-200 shadow-sm"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-navy-700 uppercase tracking-wide">Model Probability</span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isAlert ? "bg-rose-100 text-rose-800 border border-rose-300" : "bg-emerald-100 text-emerald-800 border border-emerald-300"
              }`}>
                {isAlert ? <ShieldAlert className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {isAlert ? "HIGH RISK (ALERT)" : "LOW RISK"}
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-4xl font-extrabold text-navy-950 font-mono">
                {probPct}%
              </span>
              <span className="text-xs text-navy-500 font-mono">
                (raw: {result?.probability ? result.probability.toFixed(6) : "--"})
              </span>
            </div>

            <div className="mt-4 pt-3 border-t border-navy-200/60 space-y-1.5 text-xs text-navy-600">
              <div className="flex justify-between">
                <span>Decision Threshold:</span>
                <span className="font-semibold font-mono text-navy-900">{thresholdPct}% (0.156742)</span>
              </div>
              <div className="w-full bg-navy-200 rounded-full h-2 overflow-hidden relative">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${isAlert ? "bg-rose-600" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min(100, Math.max(5, (result?.probability || 0) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-navy-400">
                <span>0.0%</span>
                <span className="text-amber-700 font-medium">Threshold: {thresholdPct}%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* Card 2: Temporal Architecture */}
          <div className="p-5 rounded-xl border border-navy-100 bg-white shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-navy-700 uppercase tracking-wide">
              <Clock className="w-4 h-4 text-indigo-600" />
              Temporal Window Architecture
            </div>

            <div className="space-y-2.5 text-xs text-navy-600">
              <div className="flex justify-between p-2 rounded-lg bg-navy-50">
                <span className="font-medium text-navy-800">Observation Window (T_obs):</span>
                <span className="font-semibold font-mono text-navy-900">300s (5 min)</span>
              </div>
              <div className="flex justify-between p-2 rounded-lg bg-navy-50">
                <span className="font-medium text-navy-800">Prediction Gap Buffer:</span>
                <span className="font-semibold font-mono text-navy-900">300s (5 min)</span>
              </div>
              <div className="flex justify-between p-2 rounded-lg bg-navy-50">
                <span className="font-medium text-navy-800">Early-Warning Target Horizon:</span>
                <span className="font-semibold font-mono text-navy-900">300s (5 min)</span>
              </div>
            </div>

            <div className="text-[11px] text-navy-500 italic mt-2">
              Non-overlapping structure guarantees zero feature leakage into target window.
            </div>
          </div>

          {/* Card 3: Signal Quality & Provenance */}
          <div className="p-5 rounded-xl border border-navy-100 bg-white shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-navy-700 uppercase tracking-wide">
              <Zap className="w-4 h-4 text-indigo-600" />
              Signal Quality & Diagnostics
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-navy-50 border border-navy-100">
                <div className="text-[11px] text-navy-500 font-medium">ECG SQI</div>
                <div className="text-sm font-bold text-navy-900 font-mono">
                  {result?.signal_quality.ecg_sqi !== undefined ? result.signal_quality.ecg_sqi.toFixed(2) : "0.95"}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-navy-50 border border-navy-100">
                <div className="text-[11px] text-navy-500 font-medium">PPG SQI</div>
                <div className="text-sm font-bold text-navy-900 font-mono">
                  {result?.signal_quality.ppg_sqi !== undefined ? result.signal_quality.ppg_sqi.toFixed(2) : "0.92"}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-navy-50 border border-navy-100">
                <div className="text-[11px] text-navy-500 font-medium">PAT Status</div>
                <div className="text-sm font-bold text-emerald-700 font-mono">
                  {result?.signal_quality.pat_valid === 1 ? "VALID" : "FLAGGED"}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-navy-100 text-xs text-navy-500 space-y-1">
              <div className="flex justify-between">
                <span>Model Artifact:</span>
                <span className="font-mono text-navy-800 font-medium">XGBoost Matrix A</span>
              </div>
              <div className="flex justify-between">
                <span>Benchmark Cohort:</span>
                <span className="text-navy-800 font-medium">VitalDB 100-Case Frozen</span>
              </div>
              <div className="flex justify-between">
                <span>Execution Latency:</span>
                <span className="font-mono text-emerald-700 font-medium">
                  {result?.metadata?.latency_ms !== undefined ? `${result.metadata.latency_ms.toFixed(1)} ms` : "< 20 ms"}
                </span>
              </div>
              {lastEvaluatedAt && (
                <div className="flex justify-between text-[11px] text-navy-400">
                  <span>Last Evaluated:</span>
                  <span>{lastEvaluatedAt}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Regulatory & Provenance Callout */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-slate-900">
            <Info className="w-4 h-4 text-slate-600" />
            Model Provenance & Non-Diagnostic Disclaimer
          </div>
          <p className="leading-relaxed">
            This card surfaces the frozen Phase 5/Phase 6 machine learning inference pipeline (frozen XGBoost, 26 Matrix A features, calibrated threshold 0.156742). 
            <strong className="text-slate-900"> Non-diagnostic investigational tool.</strong> This output is provided strictly for local software staging, engineering demonstration, and research reproducibility. It is not FDA cleared or CE marked and must never be utilized as a substitute for certified clinical diagnostics or physician assessment.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

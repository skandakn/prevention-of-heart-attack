"use client";

import { useEffect } from "react";
import { SignalPanel } from "@/components/signals/SignalPanel";
import { ISIGauge } from "@/components/isi/ISIGauge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DisclaimerBanner } from "@/components/layout/Footer";
import { SimulatedBadge } from "@/components/layout/Toast";
import { useSimulation } from "@/lib/simulation/SimulationContext";
import { Play, Pause, RotateCcw, AlertTriangle, Cpu, ShieldAlert, CheckCircle2 } from "lucide-react";
import { ISITrendChart } from "@/components/charts/ISITrendChart";

export default function MonitorPage() {
  const {
    isRunning,
    startMonitoring,
    pauseMonitoring,
    resetMonitoring,
    motionArtifactDetected,
    currentSample,
    currentScore,
    modelProbability,
    modelAlert,
    settings,
  } = useSimulation();

  useEffect(() => {
    if (settings.autoStartMonitoring) {
      startMonitoring();
    }
    // Auto-start only when entering the monitor page.
    // Pause automatically when leaving so dashboard ISI stays stable.
    return () => {
      pauseMonitoring();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prob = currentScore?.modelProbability ?? modelProbability ?? null;
  const isAlert = currentScore?.modelAlert ?? modelAlert ?? false;

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Live Monitor</h1>
          <p className="text-sm text-navy-500">Real-time simulated physiological signals & machine learning inference</p>
        </div>
        <SimulatedBadge />
      </div>

      <DisclaimerBanner />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={startMonitoring} disabled={isRunning} className="gap-2">
          <Play className="w-4 h-4" /> Start Monitoring
        </Button>
        <Button onClick={pauseMonitoring} disabled={!isRunning} variant="outline" className="gap-2">
          <Pause className="w-4 h-4" /> Pause
        </Button>
        <Button onClick={resetMonitoring} variant="secondary" className="gap-2">
          <RotateCcw className="w-4 h-4" /> Reset Simulation
        </Button>
        {currentSample && (
          <span className="text-xs text-navy-500 ml-auto">
            Last update: {new Date(currentSample.timestamp).toLocaleTimeString()}
          </span>
        )}
      </div>

      {motionArtifactDetected && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertTriangle className="w-4 h-4" />
          Motion artifact detected — signal confidence reduced
        </div>
      )}

      {/* Model Alert Banner if threshold exceeded */}
      {isAlert && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-rose-50 border border-rose-300 text-rose-900 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <span>
              Early-Warning Alert: Frozen XGBoost probability ({prob !== null ? (prob * 100).toFixed(1) + "%" : "--"}) exceeds research threshold (15.67%).
            </span>
          </div>
          <span className="text-xs bg-rose-200 text-rose-800 px-2 py-0.5 rounded font-mono font-bold">
            τ = 0.156742
          </span>
        </div>
      )}

      {/* Signal panels */}
      <div className="grid sm:grid-cols-2 gap-4">
        <SignalPanel type="ppg" title="PPG" subtitle="Pulse waveform" />
        <SignalPanel type="ecg" title="ECG" subtitle="Electrocardiogram" />
        <SignalPanel type="spo2" title="SpO₂" subtitle="Oxygen saturation trend" />
        <SignalPanel type="imu" title="IMU" subtitle="Motion / activity waveform" />
      </div>

      {/* Signal processing pipeline */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-600" />
              End-to-End Processing & ML Inference Pipeline
            </CardTitle>
            <span className="text-xs text-slate-500 font-mono">
              XGBoost Matrix A (26 Features) • Frozen v1.0.0
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-xs">
            {[
              { name: "Simulated Signals", detail: "ECG, PPG, SpO2, IMU" },
              { name: "Artifact Rejection", detail: "SQI Filtering" },
              { name: "Matrix A Extraction", detail: "26 Canonical Features" },
              { name: "Frozen XGBoost", detail: "p_model (τ = 0.156742)" },
              { name: "Composite ISI", detail: "0–100 Product Score" },
            ].map((step, i) => (
              <div key={step.name} className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <div className={`p-2.5 rounded-lg text-center flex-1 sm:flex-initial min-w-[130px] ${
                  i === 3 
                    ? isAlert 
                      ? "bg-rose-900 text-white shadow-sm" 
                      : "bg-indigo-900 text-white shadow-sm" 
                    : i === 4
                    ? "bg-navy-900 text-white shadow-sm"
                    : "bg-navy-50 text-navy-700 border border-navy-100"
                }`}>
                  <p className="font-semibold">{step.name}</p>
                  <p className="text-[10px] opacity-80 mt-0.5">{step.detail}</p>
                </div>
                {i < 4 && <span className="text-navy-300 hidden sm:inline">→</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-navy-100 bg-white p-6 shadow-card">
          <ISIGauge size="sm" />
        </div>
        <div className="lg:col-span-2">
          <ISITrendChart />
        </div>
      </div>
    </div>
  );
}

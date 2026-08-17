"use client";

import { useEffect } from "react";
import { SignalPanel } from "@/components/signals/SignalPanel";
import { ISIGauge } from "@/components/isi/ISIGauge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DisclaimerBanner } from "@/components/layout/Footer";
import { SimulatedBadge } from "@/components/layout/Toast";
import { useSimulation } from "@/lib/simulation/SimulationContext";
import { Play, Pause, RotateCcw, AlertTriangle } from "lucide-react";
import { ISITrendChart } from "@/components/charts/ISITrendChart";

export default function MonitorPage() {
  const {
    isRunning,
    startMonitoring,
    pauseMonitoring,
    resetMonitoring,
    motionArtifactDetected,
    currentSample,
    settings,
  } = useSimulation();

  useEffect(() => {
    if (settings.autoStartMonitoring) {
      startMonitoring();
    }
    // Auto-start only when entering the monitor page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Live Monitor</h1>
          <p className="text-sm text-navy-500">Real-time simulated physiological signals</p>
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

      {/* Signal panels */}
      <div className="grid sm:grid-cols-2 gap-4">
        <SignalPanel type="ppg" title="PPG" subtitle="Pulse waveform" />
        <SignalPanel type="ecg" title="ECG" subtitle="Electrocardiogram" />
        <SignalPanel type="spo2" title="SpO₂" subtitle="Oxygen saturation trend" />
        <SignalPanel type="imu" title="IMU" subtitle="Motion / activity waveform" />
      </div>

      {/* Signal processing pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Signal Processing Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-sm">
            {["Raw Signal", "Filtered Signal", "Artifact Rejection", "Feature Extraction"].map((step, i) => (
              <div key={step} className="flex items-center gap-2 sm:gap-4">
                <div className={`px-4 py-2 rounded-lg text-center ${i === 3 ? "bg-navy-900 text-white" : "bg-navy-50 text-navy-700 border border-navy-100"}`}>
                  {step}
                </div>
                {i < 3 && <span className="text-navy-300 hidden sm:inline">→</span>}
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

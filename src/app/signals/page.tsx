"use client";

import { useSimulation } from "@/lib/simulation/SimulationContext";
import { cn, formatDeviation } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "increasing") return <TrendingUp className="w-3 h-3 text-cardiac" />;
  if (trend === "decreasing") return <TrendingDown className="w-3 h-3 text-emerald-600" />;
  return <Minus className="w-3 h-3 text-navy-400" />;
}

function FeatureRow({
  label,
  current,
  baseline,
  unit,
  trend,
}: {
  label: string;
  current: string | number;
  baseline: string | number;
  unit?: string;
  trend: string;
}) {
  const deviation = formatDeviation(Number(current), Number(baseline));
  return (
    <div className="flex items-center justify-between py-2 border-b border-navy-50 last:border-0">
      <span className="text-sm text-navy-700">{label}</span>
      <div className="flex items-center gap-4 text-sm">
        <span className="font-semibold text-navy-900">{current}{unit}</span>
        <span className="text-navy-400 text-xs">Base: {baseline}{unit}</span>
        <span className={cn("text-xs font-medium w-16 text-right", deviation.startsWith("-") ? "text-cardiac" : "text-emerald-600")}>
          {deviation}
        </span>
        <TrendIcon trend={trend} />
      </div>
    </div>
  );
}

export default function SignalsPage() {
  const { features } = useSimulation();

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Feature Analysis</h1>
          <p className="text-sm text-navy-500">Extracted physiological features vs. personal baseline</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">HRV — SDNN</CardTitle>
          </CardHeader>
          <CardContent>
            <FeatureRow label="SDNN" current={features.hrv.sdnn.toFixed(1)} baseline={features.hrv.baseline} unit=" ms" trend={features.hrv.trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pulse Morphology</CardTitle>
          </CardHeader>
          <CardContent>
            <FeatureRow label="Amplitude" current={features.pulseMorphology.amplitude.toFixed(2)} baseline={features.pulseMorphology.baseline} trend={features.pulseMorphology.trend} />
            <FeatureRow label="Rise Time" current={features.pulseMorphology.riseTime.toFixed(3)} baseline="0.12" unit="s" trend={features.pulseMorphology.trend} />
            <FeatureRow label="Peak Characteristics" current={features.pulseMorphology.peakCharacteristics.toFixed(2)} baseline="0.85" trend={features.pulseMorphology.trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">SpO₂ Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <FeatureRow label="Average" current={features.spo2Trend.average.toFixed(1)} baseline={features.spo2Trend.baseline} unit="%" trend={features.spo2Trend.trend} />
            <FeatureRow label="Minimum" current={features.spo2Trend.minimum.toFixed(1)} baseline={features.spo2Trend.baseline} unit="%" trend={features.spo2Trend.trend} />
            <FeatureRow label="Slope" current={features.spo2Trend.slope.toFixed(2)} baseline="0" trend={features.spo2Trend.trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">ECG Features</CardTitle>
          </CardHeader>
          <CardContent>
            <FeatureRow label="Heart Rate" current={features.ecg.heartRate.toFixed(0)} baseline={features.ecg.baseline} unit=" bpm" trend={features.ecg.trend} />
            <FeatureRow label="RR Interval" current={features.ecg.rrInterval.toFixed(0)} baseline="882" unit=" ms" trend={features.ecg.trend} />
            <FeatureRow label="Rhythm Feature" current={features.ecg.rhythmFeature.toFixed(2)} baseline="0.90" trend={features.ecg.trend} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">IMU — Motion & Artifact</CardTitle>
          </CardHeader>
          <CardContent>
            <FeatureRow label="Motion Intensity" current={features.imu.motionIntensity.toFixed(2)} baseline={features.imu.baseline} trend={features.imu.trend} />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-navy-700">Artifact Detection</span>
              <span className={cn("text-sm font-semibold", features.imu.artifactDetected ? "text-cardiac" : "text-emerald-600")}>
                {features.imu.artifactDetected ? "Detected" : "None"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

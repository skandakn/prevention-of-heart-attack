import os

content = '''"use client";

import { useSimulation } from "@/lib/simulation/SimulationContext";
import { cn, formatDeviation } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DisclaimerBanner } from "@/components/layout/Footer";
import { SimulatedBadge } from "@/components/layout/Toast";
import { TrendingDown, TrendingUp, Minus, Cpu, ShieldAlert, CheckCircle2 } from "lucide-react";
import { CANONICAL_MATRIX_A_FEATURES, MATRIX_A_BOUNDS } from "@/lib/isi/matrix_a";

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
  const { features, matrixAFeatures, modelProbability, modelAlert } = useSimulation();

  const prob = modelProbability !== null ? (modelProbability * 100).toFixed(1) + "%" : "--";

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Feature Analysis</h1>
          <p className="text-sm text-navy-500">Extracted physiological features & 26-feature Matrix A schema</p>
        </div>
        <SimulatedBadge />
      </div>

      <DisclaimerBanner />

      {/* Matrix A Model Pipeline Header */}
      <Card className="border-indigo-100 bg-gradient-to-r from-indigo-50/50 via-white to-slate-50">
        <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-navy-900">Frozen XGBoost Matrix A (26 Features)</h2>
              <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-mono font-semibold">v1.0.0</span>
            </div>
            <p className="text-xs text-navy-600">
              Multimodal ECG, PPG, PAT & ST-segment features strictly conforming to <span className="font-mono">models/feature_schema.json</span>.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[11px] text-navy-500 font-medium">Model Probability</p>
              <p className="text-lg font-bold font-mono text-navy-900">{prob}</p>
            </div>
            <div className={cn(
              "px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5",
              modelAlert ? "bg-rose-100 border-rose-300 text-rose-800" : "bg-emerald-100 border-emerald-300 text-emerald-800"
            )}>
              {modelAlert ? <ShieldAlert className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              {modelAlert ? "ALERT (≥ 0.156742)" : "NORMAL (< 0.156742)"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 26-Feature Matrix A Detailed Inspection Grid */}
      {matrixAFeatures && (
        <Card>
          <CardHeader className="pb-3 border-b border-navy-50">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Canonical 26-Feature Vector</span>
              <span className="text-xs font-normal text-navy-500 font-mono">26 / 26 Active</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {CANONICAL_MATRIX_A_FEATURES.map((featKey, idx) => {
              const val = matrixAFeatures[featKey];
              const bounds = MATRIX_A_BOUNDS[featKey];
              const isST = featKey.startsWith("st_");
              const isECG = featKey.startsWith("ecg_");
              const isPAT = featKey.startsWith("pat_");
              const isPPG = featKey.startsWith("ppg_");
              const isSpO2 = featKey.startsWith("spo2_");

              let badgeColor = "bg-slate-100 text-slate-700";
              if (isST) badgeColor = "bg-rose-50 text-rose-700 border-rose-100";
              else if (isECG) badgeColor = "bg-blue-50 text-blue-700 border-blue-100";
              else if (isPAT) badgeColor = "bg-purple-50 text-purple-700 border-purple-100";
              else if (isPPG) badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
              else if (isSpO2) badgeColor = "bg-sky-50 text-sky-700 border-sky-100";

              return (
                <div key={featKey} className="p-2.5 rounded-lg border border-navy-100 bg-white hover:border-navy-300 transition text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-navy-400 text-[10px]">#{idx + 1}</span>
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold border", badgeColor)}>
                      {isST ? "ST" : isECG ? "ECG" : isPAT ? "PAT" : isPPG ? "PPG" : "SpO2"}
                    </span>
                  </div>
                  <p className="font-mono font-medium text-navy-800 truncate" title={featKey}>{featKey}</p>
                  <p className="text-sm font-bold font-mono text-navy-900">
                    {typeof val === "number" ? (Number.isInteger(val) ? val : val.toFixed(featKey.includes("sqi") || featKey.includes("slope") ? 3 : 2)) : val}
                  </p>
                  <p className="text-[10px] text-navy-400">
                    Range: [{bounds[0]}, {bounds[1]}]
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Feature Analysis Cards */}
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
'''

target_path = r"C:\ischemic\src\app\signals\page.tsx"
with open(target_path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Successfully updated {target_path}")

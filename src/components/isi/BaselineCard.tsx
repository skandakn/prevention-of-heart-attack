"use client";

import { useSimulation } from "@/lib/simulation/SimulationContext";
import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import type { FeatureSet, PersonalBaseline, PhysiologicalSample } from "@/lib/isi/types";
import { cn, formatDeviation } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, TrendingUp, Minus, Lock, Sparkles } from "lucide-react";
import Link from "next/link";

interface BaselineCardProps {
  sample?: PhysiologicalSample;
  baseline?: PersonalBaseline;
  features?: FeatureSet;
  title?: string;
}

export function BaselineCard({
  sample: sampleProp,
  baseline: baselineProp,
  features: featuresProp,
  title = "Your Baseline",
}: BaselineCardProps = {}) {
  const sim = useSimulation();
  const { canAccessFeature, subscribeToPro, setDemoMode } = useSubscription();

  const currentSample = sampleProp ?? sim.currentSample;
  const baseline = baselineProp ?? sim.baseline;
  const features = featuresProp ?? sim.features;

  const hasAccess = canAccessFeature("PERSONAL_BASELINE");

  const metrics = [
    {
      label: "Resting HR",
      current: Math.round(currentSample.heartRate),
      baseline: baseline.restingHR,
      unit: "bpm",
    },
    {
      label: "HRV (SDNN)",
      current: Math.round(currentSample.hrv),
      baseline: baseline.hrv,
      unit: "ms",
    },
    {
      label: "SpO₂",
      current: currentSample.spo2.toFixed(1),
      baseline: baseline.spo2,
      unit: "%",
    },
    {
      label: "Pulse Morphology",
      current: features.pulseMorphology.amplitude.toFixed(2),
      baseline: baseline.pulseMorphology,
      unit: "",
    },
  ];

  return (
    <Card className="relative overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          {!hasAccess && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">
              <Lock className="w-3 h-3" /> Pro Feature
            </span>
          )}
        </div>
        <p className="text-xs text-navy-500 mt-1">
          ISI is normalized against your rolling baseline rather than population-wide norms.
        </p>
      </CardHeader>
      <CardContent>
        <div className={cn("space-y-4", !hasAccess && "filter blur-xs opacity-40 pointer-events-none select-none")}>
          {metrics.map((m) => {
            const deviation = formatDeviation(Number(m.current), m.baseline);
            const isNegative = deviation.startsWith("-");
            return (
              <div key={m.label} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-navy-900">{m.label}</p>
                  <p className="text-xs text-navy-400">
                    Baseline: {m.baseline}{m.unit}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-navy-900">
                    {m.current}{m.unit}
                  </p>
                  <p className={cn("text-xs font-medium flex items-center justify-end gap-0.5", isNegative ? "text-cardiac" : "text-emerald-600")}>
                    {isNegative ? <TrendingDown className="w-3 h-3" /> : deviation === "0%" ? <Minus className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                    {deviation}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {!hasAccess && (
          <div className="absolute inset-0 bg-navy-950/20 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center">
            <div className="bg-white p-4 rounded-xl shadow-lg border border-navy-100 max-w-xs space-y-2">
              <div className="inline-flex p-2 rounded-full bg-red-50 text-cardiac">
                <Lock className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-sm text-navy-900">Personal Baseline Analytics</h4>
              <p className="text-xs text-navy-500">
                Unlock rolling individual baselines with BeatAhead Pro (₹599/mo).
              </p>
              <div className="pt-1 flex flex-col gap-1.5">
                <button
                  onClick={subscribeToPro}
                  className="w-full text-xs font-semibold py-1.5 px-3 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors flex items-center justify-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Subscribe for ₹599/mo
                </button>
                <button
                  onClick={() => setDemoMode(true)}
                  className="text-[11px] text-amber-700 hover:text-amber-900 font-medium underline"
                >
                  Enable Demo Mode →
                </button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

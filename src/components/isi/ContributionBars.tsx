"use client";

import { useSimulation } from "@/lib/simulation/SimulationContext";
import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import type { ISIContributions } from "@/lib/isi/types";
import { getContributionInfluence } from "@/lib/isi/features";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Lock, Sparkles } from "lucide-react";

interface ContributionBarsProps {
  contributions?: ISIContributions;
}

export function ContributionBars({ contributions: contributionsProp }: ContributionBarsProps = {}) {
  const { currentScore } = useSimulation();
  const { canAccessFeature, subscribeToPro, setDemoMode } = useSubscription();

  const contributions = contributionsProp ?? currentScore.contributions;
  const hasAccess = canAccessFeature("FEATURE_CONTRIBUTIONS");

  const items = [
    { label: "HRV", value: contributions.hrv, key: "hrv" as const },
    { label: "Pulse Morphology", value: contributions.pulseMorphology, key: "pulseMorphology" as const },
    { label: "SpO₂ Trend", value: contributions.spo2Trend, key: "spo2Trend" as const },
    { label: "ECG", value: contributions.ecg, key: "ecg" as const },
    { label: "Motion / Artifact", value: contributions.motionArtifact, key: "motionArtifact" as const },
  ];

  return (
    <Card className="relative overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Why did the ISI change?</CardTitle>
          {!hasAccess && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">
              <Lock className="w-3 h-3" /> Pro Feature
            </span>
          )}
        </div>
        <p className="text-xs text-navy-500">Prototype model contribution visualization</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className={cn("space-y-5", !hasAccess && "filter blur-xs opacity-40 pointer-events-none select-none")}>
          {items.map((c) => (
            <div key={c.key}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-navy-900">{c.label}</span>
                <span className="text-xs text-navy-500">{getContributionInfluence(c.value)}</span>
              </div>
              <Progress value={c.value * 100} className="h-2" />
            </div>
          ))}
          <p className="text-[10px] text-navy-400 pt-2 border-t border-navy-100">
            These are prototype model weights — not clinically validated feature contributions.
          </p>
        </div>

        {!hasAccess && (
          <div className="absolute inset-0 bg-navy-950/20 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center">
            <div className="bg-white p-4 rounded-xl shadow-lg border border-navy-100 max-w-xs space-y-2">
              <div className="inline-flex p-2 rounded-full bg-red-50 text-cardiac">
                <Lock className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-sm text-navy-900">Feature Contribution Analysis</h4>
              <p className="text-xs text-navy-500">
                Unlock explainable feature weights with BeatAhead Pro (₹599/mo).
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

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

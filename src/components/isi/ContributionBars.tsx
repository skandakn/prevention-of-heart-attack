"use client";

import { useSimulation } from "@/lib/simulation/SimulationContext";
import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import type { ISIContributions } from "@/lib/isi/types";
import { getContributionInfluence } from "@/lib/isi/features";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Lock, Sparkles, Cpu } from "lucide-react";

interface ContributionBarsProps {
  contributions?: ISIContributions;
}

export function ContributionBars({ contributions: contributionsProp }: ContributionBarsProps = {}) {
  const { currentScore } = useSimulation();
  const { canAccessFeature, subscribeToPro, setDemoMode } = useSubscription();

  const contributions = contributionsProp ?? currentScore.contributions;
  const hasAccess = canAccessFeature("FEATURE_CONTRIBUTIONS");

  const items = [
    { label: "Model Evidence (E_model)", value: contributions.modelEvidence ?? 0.05, key: "modelEvidence" as const },
    { label: "Autonomic Strain (D_auto)", value: contributions.autonomic ?? 0.10, key: "autonomic" as const },
    { label: "Vascular Perfusion (D_perf)", value: contributions.perfusion ?? 0.08, key: "perfusion" as const },
    { label: "HRV (SDNN Deviation)", value: contributions.hrv, key: "hrv" as const },
    { label: "Motion / Artifact", value: contributions.motionArtifact, key: "motionArtifact" as const },
  ];

  return (
    <Card className="relative overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-600" />
            Why did the ISI change?
          </CardTitle>
          {!hasAccess && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">
              <Lock className="w-3 h-3" /> Pro Feature
            </span>
          )}
        </div>
        <p className="text-xs text-navy-500">Multi-source physiological component contribution breakdown</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={cn("space-y-4", !hasAccess && "filter blur-xs opacity-40 pointer-events-none select-none")}>
          {items.map((c) => (
            <div key={c.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-navy-900">{c.label}</span>
                <span className="text-[11px] font-mono text-navy-600">{(c.value * 100).toFixed(1)}%</span>
              </div>
              <Progress value={Math.min(100, Math.max(0, c.value * 100))} className="h-2" />
            </div>
          ))}
          <p className="text-[10px] text-navy-400 pt-2 border-t border-navy-100">
            Prototype multi-source engineering contributions — not clinically validated diagnostic weights.
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
                Unlock explainable feature weights with BeatAhead Pro (₹1599/mo).
              </p>
              <div className="pt-1 flex flex-col gap-1.5">
                <button
                  onClick={subscribeToPro}
                  className="w-full text-xs font-semibold py-1.5 px-3 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors flex items-center justify-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Subscribe for ₹1599/mo
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

import os

# 1. Update ISIGauge.tsx
gauge_content = r'''"use client";

import { useSimulation } from "@/lib/simulation/SimulationContext";
import { cn, getISILabel } from "@/lib/utils";
import { Info, ShieldAlert, CheckCircle2, Cpu } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MEDICAL_DISCLAIMER } from "@/lib/isi/types";

interface ISIGaugeProps {
  score?: number;
  baseline?: number;
  trend?: string;
  confidence?: number;
  size?: "sm" | "lg";
}

export function ISIGauge({
  score: propScore,
  baseline: propBaseline,
  trend: propTrend,
  confidence: propConfidence,
  size = "lg",
}: ISIGaugeProps) {
  const { currentScore } = useSimulation();
  const score = propScore ?? currentScore?.score ?? 0;
  const baseline = propBaseline ?? currentScore?.baseline ?? 40;
  const trend = propTrend ?? currentScore?.trend ?? "stable";
  const confidence = propConfidence ?? currentScore?.confidence ?? 0;
  const deviation = score - baseline;

  const modelEvidencePct = currentScore?.modelEvidence !== undefined 
    ? (currentScore.modelEvidence * 100).toFixed(1) 
    : "--";
  const modelAlert = currentScore?.modelAlert ?? false;
  const productState = currentScore?.state ?? "Normal / Stable";

  const circumference = 2 * Math.PI * 88;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getScoreColor = (s: number) => {
    if (s <= 30) return "#10B981";
    if (s <= 60) return "#F59E0B";
    return "#DC2626";
  };

  const trendIcon = trend === "increasing" ? "↑" : trend === "decreasing" ? "↓" : "→";

  return (
    <div className="flex flex-col items-center">
      <div className={cn("relative", size === "lg" ? "w-52 h-52" : "w-36 h-36")}>
        <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="88" fill="none" stroke="#E2E8F0" strokeWidth="12" />
          <circle
            cx="100"
            cy="100"
            r="88"
            fill="none"
            stroke={getScoreColor(score)}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-bold text-navy-900 font-mono", size === "lg" ? "text-5xl" : "text-3xl")}>
            {score}
          </span>
          <span className="text-xs font-semibold tracking-wider text-navy-500 uppercase mt-0.5">
            ISI: {score} / 100
          </span>
        </div>
      </div>

      <p className="mt-2 text-sm font-semibold text-navy-800">{getISILabel(score)}</p>
      
      <span className="mt-1 text-[11px] font-medium text-navy-500 bg-navy-50 px-2 py-0.5 rounded-full border border-navy-100">
        Status: {productState}
      </span>

      {/* Model Information Separator (Task 10 Requirement) */}
      <div className="mt-3 w-full p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5">
        <div className="flex items-center justify-between font-medium">
          <span className="text-slate-600 flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-indigo-600" />
            Model Evidence:
          </span>
          <span className="font-mono font-bold text-navy-900">{modelEvidencePct}%</span>
        </div>
        <div className="flex items-center justify-between font-medium">
          <span className="text-slate-600">Model State:</span>
          <span className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold",
            modelAlert 
              ? "bg-rose-100 text-rose-800 border border-rose-200" 
              : "bg-emerald-100 text-emerald-800 border border-emerald-200"
          )}>
            {modelAlert ? <ShieldAlert className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
            {modelAlert ? "ALERT (≥ 0.156742)" : "NORMAL (< 0.156742)"}
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs w-full">
        <div>
          <span className="text-navy-400">Personal baseline</span>
          <p className="font-semibold text-navy-900">{baseline}</p>
        </div>
        <div>
          <span className="text-navy-400">Current deviation</span>
          <p className={cn("font-semibold", deviation > 0 ? "text-cardiac" : "text-emerald-600")}>
            {deviation > 0 ? "+" : ""}{deviation}
          </p>
        </div>
        <div>
          <span className="text-navy-400">Trend</span>
          <p className="font-semibold text-navy-900 capitalize">{trendIcon} {trend}</p>
        </div>
        <div>
          <span className="text-navy-400">Confidence</span>
          <p className="font-semibold text-navy-900">{confidence}%</p>
        </div>
      </div>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger className="mt-2.5 flex items-center gap-1 text-[11px] text-navy-400 hover:text-navy-600">
            <Info className="w-3 h-3" />
            About ISI Scoring Architecture
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-xs">{MEDICAL_DISCLAIMER}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <p className="mt-1 text-[10px] text-navy-400 text-center max-w-xs">
        Prototype research composite index — not a clinically validated risk score.
      </p>
    </div>
  );
}
'''

with open(r"C:\ischemic\src\components\isi\ISIGauge.tsx", "w", encoding="utf-8") as f:
    f.write(gauge_content)
print("Updated ISIGauge.tsx")


# 2. Update RiskTrendBanner.tsx
banner_content = r'''"use client";

import { useSimulation } from "@/lib/simulation/SimulationContext";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Info, CheckCircle2, ShieldAlert } from "lucide-react";

export function RiskTrendBanner() {
  const { currentScore, baseline } = useSimulation();

  if (!currentScore) return null;

  const state = currentScore.state || "Normal / Stable";
  const modelAlert = currentScore.modelAlert || false;
  const isElevatedTrend = currentScore.score > baseline.isi + 10 || state === "Elevated ISI Trend";

  let bannerStyle = "border-emerald-200 bg-emerald-50 text-emerald-900";
  let icon = <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />;
  let title = "Physiological patterns are within the user's recent personal baseline range.";
  let subtitle = "Multi-sensor autonomic and vascular transit metrics reflect stable resting conditions.";

  if (state === "Insufficient Signal Quality") {
    bannerStyle = "border-slate-300 bg-slate-100 text-slate-900";
    icon = <Info className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />;
    title = "Signal quality is degraded or sensor contact is unstable.";
    subtitle = "Calculations are paused to prevent false precision. Please check sensor fit.";
  } else if (state === "Baseline Establishing") {
    bannerStyle = "border-blue-200 bg-blue-50 text-blue-900";
    icon = <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />;
    title = "Establishing personal baseline...";
    subtitle = "Observing quiet resting patterns. Adaptive baseline stabilizes after 10 minutes.";
  } else if (state === "Elevated Model Evidence" || modelAlert) {
    bannerStyle = "border-rose-200 bg-rose-50 text-rose-900";
    icon = <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />;
    title = "Model evidence is elevated relative to the configured research threshold (0.156742).";
    subtitle = "Prospective early-warning pattern detected in multimodal signals. Observational trend only.";
  } else if (isElevatedTrend) {
    bannerStyle = "border-amber-200 bg-amber-50 text-amber-900";
    icon = <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />;
    title = "Observed physiological trend has moved above the user's personal baseline range.";
    subtitle = "Persistent changes may warrant discussion with a qualified healthcare professional.";
  }

  return (
    <Card className={bannerStyle}>
      <CardContent className="p-4 flex items-start gap-3">
        {icon}
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs opacity-90 mt-0.5">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}
'''

with open(r"C:\ischemic\src\components\isi\RiskTrendBanner.tsx", "w", encoding="utf-8") as f:
    f.write(banner_content)
print("Updated RiskTrendBanner.tsx")


# 3. Update ContributionBars.tsx
bars_content = r'''"use client";

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
'''

with open(r"C:\ischemic\src\components\isi\ContributionBars.tsx", "w", encoding="utf-8") as f:
    f.write(bars_content)
print("Updated ContributionBars.tsx")

"use client";

import { ContributionBars } from "@/components/isi/ContributionBars";
import { ISIGauge } from "@/components/isi/ISIGauge";
import { RiskTrendBanner } from "@/components/isi/RiskTrendBanner";
import { DisclaimerBanner } from "@/components/layout/Footer";
import { SimulatedBadge } from "@/components/layout/Toast";
import { ResearchModelSignalCard } from "@/components/ml/ResearchModelSignalCard";
import { useSimulation } from "@/lib/simulation/SimulationContext";
import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import { Paywall } from "@/components/ui/Paywall";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getContributionInfluence, getConfidenceImpact } from "@/lib/isi/features";
import { Cpu, ShieldAlert, CheckCircle2, Activity, Info } from "lucide-react";

export default function InsightsPage() {
  const { currentScore } = useSimulation();
  const { canAccessFeature } = useSubscription();

  const hasAccess = canAccessFeature("AI_INSIGHTS");

  const modelEvidence = currentScore?.modelEvidence ?? 0.05;
  const modelAlert = currentScore?.modelAlert ?? false;
  const state = currentScore?.state ?? "Normal / Stable";

  const summary = [
    { 
      label: "Model Evidence (E_model)", 
      value: (modelEvidence * 100).toFixed(1) + "%", 
      influence: modelAlert ? "Elevated (≥ 0.156742)" : "Baseline (< 0.156742)" 
    },
    { 
      label: "Autonomic Strain (D_auto)", 
      value: currentScore ? ((currentScore.contributions.autonomic ?? 0.1) * 100).toFixed(1) + "%" : "10.0%", 
      influence: getContributionInfluence(currentScore?.contributions.autonomic ?? 0.1) 
    },
    { 
      label: "Vascular Perfusion (D_perf)", 
      value: currentScore ? ((currentScore.contributions.perfusion ?? 0.08) * 100).toFixed(1) + "%" : "8.0%", 
      influence: getContributionInfluence(currentScore?.contributions.perfusion ?? 0.08) 
    },
    { 
      label: "HRV Deviation", 
      value: currentScore ? (currentScore.contributions.hrv * 100).toFixed(1) + "%" : "5.0%", 
      influence: getContributionInfluence(currentScore?.contributions.hrv ?? 0.05) 
    },
    { 
      label: "Motion / Artifact", 
      value: currentScore ? (currentScore.contributions.motionArtifact * 100).toFixed(1) + "%" : "0.0%", 
      influence: getConfidenceImpact(currentScore?.contributions.motionArtifact ?? 0) 
    },
  ];

  const content = (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">AI Insights</h1>
          <p className="text-sm text-navy-500">Explainable multi-source physiological analysis & research model signal</p>
        </div>
        <SimulatedBadge />
      </div>

      <DisclaimerBanner />

      {/* Phase 7 Staging ML Integration: Research Model Signal */}
      <ResearchModelSignalCard />

      <RiskTrendBanner />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-navy-100 bg-white p-6 shadow-card">
          <ISIGauge />
        </div>
        <div className="lg:col-span-2">
          <ContributionBars />
        </div>
      </div>

      {/* Observational Analysis Summary (Strict Non-Diagnostic Copy) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" />
            Physiological Component Summary
          </CardTitle>
          <p className="text-xs text-navy-500">
            Multi-source component influence on current ISI score — prototype synthesis, not clinically validated
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {summary.map((s) => (
              <div key={s.label} className="flex flex-col justify-between p-3 rounded-lg bg-navy-50 border border-navy-100 space-y-1">
                <span className="text-xs font-semibold text-navy-700">{s.label}</span>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold font-mono text-navy-900">{s.value}</span>
                  <span className="text-[11px] font-medium text-navy-500">{s.influence}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-navy-100 flex items-start gap-2 text-xs text-navy-600">
            <Info className="w-4 h-4 text-navy-400 shrink-0 mt-0.5" />
            <p>
              Explanations quantify shifts relative to personal resting baselines and research model weights. 
              This software provides observational trends only and does not diagnose medical conditions.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (!hasAccess) {
    return (
      <div className="p-4 lg:p-8 max-w-7xl mx-auto">
        <Paywall featureName="AI Insights & Contribution Graph">
          {content}
        </Paywall>
      </div>
    );
  }

  return content;
}

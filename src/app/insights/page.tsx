"use client";

import { ContributionBars } from "@/components/isi/ContributionBars";
import { ISIGauge } from "@/components/isi/ISIGauge";
import { RiskTrendBanner } from "@/components/isi/RiskTrendBanner";

import { useSimulation } from "@/lib/simulation/SimulationContext";
import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import { Paywall } from "@/components/ui/Paywall";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getContributionInfluence, getConfidenceImpact } from "@/lib/isi/features";

export default function InsightsPage() {
  const { currentScore } = useSimulation();
  const { canAccessFeature } = useSubscription();

  const hasAccess = canAccessFeature("AI_INSIGHTS");

  const summary = [
    { label: "HRV", value: currentScore.contributions.hrv, influence: getContributionInfluence(currentScore.contributions.hrv) },
    { label: "SpO₂ Trend", value: currentScore.contributions.spo2Trend, influence: getContributionInfluence(currentScore.contributions.spo2Trend) },
    { label: "Pulse Morphology", value: currentScore.contributions.pulseMorphology, influence: getContributionInfluence(currentScore.contributions.pulseMorphology) },
    { label: "Motion Artifact", value: currentScore.contributions.motionArtifact, influence: getConfidenceImpact(currentScore.contributions.motionArtifact) },
  ];

  const content = (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">AI Insights</h1>
        <p className="text-sm text-navy-500">Explainable model contribution analysis</p>
      </div>

      <RiskTrendBanner />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-navy-100 bg-white p-6 shadow-card">
          <ISIGauge />
        </div>
        <div className="lg:col-span-2">
          <ContributionBars />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contribution Summary</CardTitle>
          <p className="text-xs text-navy-500">Prototype model contribution visualization — not clinically validated</p>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            {summary.map((s) => (
              <div key={s.label} className="flex items-center justify-between p-3 rounded-lg bg-navy-50 border border-navy-100">
                <span className="text-sm font-medium text-navy-900">{s.label}</span>
                <span className="text-xs text-navy-500">{s.influence}</span>
              </div>
            ))}
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

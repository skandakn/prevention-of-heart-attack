"use client";

import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { ISITrendChart } from "@/components/charts/ISITrendChart";
import { ISIGauge } from "@/components/isi/ISIGauge";
import { BaselineCard } from "@/components/isi/BaselineCard";
import { RiskTrendBanner } from "@/components/isi/RiskTrendBanner";
import { ContributionBars } from "@/components/isi/ContributionBars";
import { DisclaimerBanner } from "@/components/layout/Footer";
import { SimulatedBadge } from "@/components/layout/Toast";
import { useSimulation } from "@/lib/simulation/SimulationContext";
import { ISI_RANGE_LABELS } from "@/lib/isi/types";

export default function DashboardPage() {
  const { settings } = useSimulation();
  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Dashboard</h1>
          <p className="text-sm text-navy-500 mt-0.5">Live Physiological Monitoring</p>
        </div>
        <SimulatedBadge />
      </div>

      <DisclaimerBanner />

      <DashboardStats />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ISITrendChart />
          <RiskTrendBanner />
        </div>
        <div className="space-y-6">
          <div className="rounded-xl border border-navy-100 bg-white p-6 shadow-card">
            <ISIGauge />
          </div>
          {settings.showRangeLabels && (
            <div className="rounded-xl border border-navy-100 bg-white p-4 space-y-2">
              <p className="text-xs font-semibold text-navy-500 uppercase">ISI Ranges (Illustrative)</p>
              {Object.values(ISI_RANGE_LABELS).map((r) => (
                <div key={r.range} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-navy-700">{r.range}</span>
                  <span className="text-navy-500">{r.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <BaselineCard />
        <ContributionBars />
      </div>
    </div>
  );
}

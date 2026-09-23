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
import Link from "next/link";
import { Heart, PhoneCall, FileText, CreditCard, BookOpen, Info } from "lucide-react";

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

      {/* ── Footer Section ──────────────────────────────────────────── */}
      <footer className="mt-12 pt-8 border-t border-navy-100">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* BeatAhead Branding */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-navy-900">
                <Heart className="w-4 h-4 text-white" fill="white" />
              </div>
              <span className="text-lg font-bold text-navy-900">BeatAhead</span>
            </div>
            <p className="text-xs text-navy-500">
              ISI Platform for Cardiac Wellness
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xs font-semibold text-navy-700 uppercase tracking-wide mb-3">
              Quick Links
            </h3>
            <div className="space-y-2">
              <Link
                href="/helpline"
                className="flex items-center gap-2 text-sm text-navy-600 hover:text-navy-900 transition-colors"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                Cardiac Helpline
              </Link>
              <Link
                href="/calls"
                className="flex items-center gap-2 text-sm text-navy-600 hover:text-navy-900 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                Call Records
              </Link>
            </div>
          </div>

          {/* Information */}
          <div>
            <h3 className="text-xs font-semibold text-navy-700 uppercase tracking-wide mb-3">
              Information
            </h3>
            <div className="space-y-2">
              <Link
                href="/pricing"
                className="flex items-center gap-2 text-sm text-navy-600 hover:text-navy-900 transition-colors"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Pricing
              </Link>
              <Link
                href="/methodology"
                className="flex items-center gap-2 text-sm text-navy-600 hover:text-navy-900 transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Methodology
              </Link>
              <Link
                href="/about"
                className="flex items-center gap-2 text-sm text-navy-600 hover:text-navy-900 transition-colors"
              >
                <Info className="w-3.5 h-3.5" />
                About
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-6 border-t border-navy-100 text-center">
          <p className="text-xs text-navy-400">
            © {new Date().getFullYear()} BeatAhead. Research prototype.
          </p>
        </div>
      </footer>
    </div>
  );
}

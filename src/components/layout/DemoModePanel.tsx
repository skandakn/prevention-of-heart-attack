"use client";

import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import { FlaskConical, ShieldCheck, Sparkles } from "lucide-react";

interface DemoModePanelProps {
  compact?: boolean;
}

export function DemoModePanel({ compact }: DemoModePanelProps) {
  const { demoMode, setDemoMode } = useSubscription();

  if (compact) {
    return (
      <div className="space-y-3 p-2.5 rounded-xl border border-amber-200 bg-amber-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
            <FlaskConical className="w-3.5 h-3.5 text-amber-600" />
            Judge Demo Mode
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={demoMode}
              onChange={(e) => setDemoMode(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-8 h-4.5 bg-navy-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-navy-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-amber-600"></div>
          </label>
        </div>
        <p className="text-[11px] text-amber-800 leading-snug">
          Unlock all Pro features for ideathon presentation without paying.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-navy-100 bg-white p-4 space-y-4 shadow-sm">
      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-amber-950">Judge Demo Mode</h3>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={demoMode}
              onChange={(e) => setDemoMode(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-navy-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-navy-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
          </label>
        </div>
        <p className="text-xs text-amber-800">
          Enables full access to AI Insights, Personal Baseline, Trends &amp; Clinician View for presentation.
        </p>
        {demoMode && (
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-600 text-white">
            <Sparkles className="w-3 h-3" /> DEMO MODE ACTIVE
          </div>
        )}
      </div>
    </div>
  );
}

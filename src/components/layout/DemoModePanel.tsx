"use client";

import { DEMO_SCENARIOS, type DemoScenario } from "@/lib/isi/types";
import { useSimulation } from "@/lib/simulation/SimulationContext";
import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import { cn } from "@/lib/utils";
import { FlaskConical, ShieldCheck, Sparkles } from "lucide-react";

interface DemoModePanelProps {
  compact?: boolean;
}

export function DemoModePanel({ compact }: DemoModePanelProps) {
  const { scenario, setScenario } = useSimulation();
  const { demoMode, setDemoMode, subscriptionStatus } = useSubscription();

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

        <div className="pt-2 border-t border-amber-200/60 space-y-1.5">
          <div className="text-[10px] font-semibold uppercase text-navy-400">Simulation Scenario</div>
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value as DemoScenario)}
            className="w-full text-xs rounded-lg border border-navy-200 bg-white px-2 py-1.5 text-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-900"
          >
            {DEMO_SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
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
          Enables full access to AI Insights, Personal Baseline, Trends & Clinician View for presentation.
        </p>
        {demoMode && (
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-600 text-white">
            <Sparkles className="w-3 h-3" /> DEMO MODE ACTIVE
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-navy-600" />
          <h3 className="text-sm font-semibold text-navy-900">Physiological Scenario</h3>
        </div>
        <div className="space-y-1.5">
          {DEMO_SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => setScenario(s.id)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-xs transition-colors",
                scenario === s.id
                  ? "bg-navy-900 text-white"
                  : "bg-navy-50 text-navy-700 hover:bg-navy-100 border border-navy-100"
              )}
            >
              <div className="font-medium">{s.label}</div>
              <div className={cn("text-[10px] mt-0.5", scenario === s.id ? "text-navy-300" : "text-navy-400")}>
                {s.description}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useSimulation } from "@/lib/simulation/SimulationContext";
import { useSubscription, isPremiumAccount } from "@/lib/subscription/SubscriptionContext";
import { useBeatAheadAuth } from "@/lib/auth/ClerkAuthWrapper";
import { cn } from "@/lib/utils";
import { X, Settings, ShieldCheck, CreditCard, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { settings, updateSettings } = useSimulation();
  const { user } = useBeatAheadAuth();
  const isWhitelisted = isPremiumAccount(user?.email);
  const {
    subscriptionStatus,
    demoMode,
    setDemoMode,
    subscribeToPro,
    setSubscriptionStatusState,
  } = useSubscription();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs" onClick={onClose}>
      <div
        className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-elevated overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-navy-100 px-4 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-navy-600" />
            <h2 className="font-semibold text-navy-900">Prototype Settings & Controls</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-navy-50" aria-label="Close settings">
            <X className="w-5 h-5 text-navy-500" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Section: Prototype Controls & Judge Demo Mode */}
          <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-3">
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
            <p className="text-xs text-amber-800 leading-relaxed">
              Enables all Pro features (AI Insights, Personal Baseline, Trends, Clinician Dashboard) for demonstration without requiring a real payment.
            </p>
            {demoMode ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-600 text-white text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" /> DEMO MODE ACTIVE
              </div>
            ) : (
              <span className="text-xs text-navy-500">Demo mode is off. Access controlled by active subscription.</span>
            )}
          </section>

          {/* Section: Subscription Controls */}
          <section className="rounded-xl border border-navy-200 bg-white p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-navy-700" />
                <h3 className="text-sm font-bold text-navy-900">Subscription Status</h3>
              </div>
              <span
                className={cn(
                  "px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider",
                  (subscriptionStatus === "active" || isWhitelisted)
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : "bg-navy-100 text-navy-700"
                )}
              >
                {isWhitelisted
                  ? "PRO (COMPETITION ACCESS) ✓"
                  : subscriptionStatus === "active"
                  ? "PRO ✓"
                  : "FREE USER"}
              </span>
            </div>

            <p className="text-xs text-navy-500">
              {isWhitelisted
                ? "Permanent competition VIP status granted. All features fully unlocked for judges."
                : "Real Razorpay Test Mode integration (₹599/month)."}
            </p>

            {isWhitelisted ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-medium">
                ★ Permanent Competition Access active for <span className="font-bold">{user?.email}</span>. AI Insights, Personal Baseline, Trends, Clinician View, and Agents are permanently unlocked.
              </div>
            ) : (
              <div className="flex flex-col gap-2 pt-1">
                {subscriptionStatus !== "active" ? (
                  <Button
                    onClick={subscribeToPro}
                    size="sm"
                    className="w-full bg-navy-900 hover:bg-navy-800 text-white gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    Subscribe for ₹599/month
                  </Button>
                ) : (
                  <Button
                    onClick={() => setSubscriptionStatusState("inactive")}
                    variant="outline"
                    size="sm"
                    className="w-full text-xs text-red-600 border-red-200 hover:bg-red-50"
                  >
                    Simulate Subscription Cancellation
                  </Button>
                )}
              </div>
            )}
          </section>

          {/* Section: Display Settings */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase text-navy-400">Display Settings</h3>
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-navy-700">Show ISI Range Guide</p>
                <p className="text-[11px] text-navy-400">Display the 0-30, 31-60, 61-100 illustrative scale</p>
              </div>
              <input
                type="checkbox"
                checked={settings.showRangeLabels}
                onChange={(e) => updateSettings({ showRangeLabels: e.target.checked })}
                className="w-4 h-4 rounded border-navy-300 text-navy-900 focus:ring-navy-500"
              />
            </label>
          </section>
        </div>
      </div>
    </div>
  );
}

export function SettingsButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn("p-2 rounded-lg hover:bg-navy-50 text-navy-500", className)}
        aria-label="Open settings"
      >
        <Settings className="w-4 h-4" />
      </button>
      <SettingsPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}

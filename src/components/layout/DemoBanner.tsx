"use client";

import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import { FlaskConical, X, Sparkles } from "lucide-react";

export function DemoBanner() {
  const { demoMode, setDemoMode } = useSubscription();

  if (!demoMode) return null;

  return (
    <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 text-white px-4 py-2.5 shadow-md relative z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm font-medium">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white animate-pulse">
            <FlaskConical className="w-3.5 h-3.5" />
          </span>
          <span className="font-bold tracking-wide uppercase text-white">
            DEMO MODE — PRO FEATURES UNLOCKED
          </span>
          <span className="hidden md:inline-block text-amber-100 text-xs border-l border-amber-400/60 pl-2 ml-1">
            Presentation Mode · No Payment Recorded · Prototype Evaluation
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDemoMode(false)}
            className="inline-flex items-center gap-1 bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-md text-xs font-semibold text-white transition-colors"
          >
            <span>Exit Demo Mode</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

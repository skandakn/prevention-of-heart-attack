"use client";

import { useSimulation } from "@/lib/simulation/SimulationContext";
import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

export function Toast() {
  const { toastMessage } = useSimulation();

  if (!toastMessage) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-6 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in">
      <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-navy-900 text-white text-sm shadow-elevated">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        {toastMessage}
      </div>
    </div>
  );
}

export function SimulatedBadge({ className, isLive = false }: { className?: string; isLive?: boolean }) {
  return null;
}

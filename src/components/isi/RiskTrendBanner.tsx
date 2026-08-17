"use client";

import { useSimulation } from "@/lib/simulation/SimulationContext";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export function RiskTrendBanner() {
  const { currentScore, baseline } = useSimulation();

  if (!currentScore) return null;

  const isElevated = currentScore.score > baseline.isi + 10;

  return (
    <Card className={isElevated ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}>
      <CardContent className="p-4 flex items-start gap-3">
        {isElevated && <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />}
        <div>
          <p className="text-sm font-medium text-navy-900">
            {isElevated
              ? "Observed physiological trend has moved above the user's recent personal baseline."
              : "Physiological patterns are within the user's recent personal baseline range."}
          </p>
          {isElevated && (
            <p className="text-xs text-navy-600 mt-1">
              Persistent changes may warrant discussion with a qualified healthcare professional.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useSimulation } from "@/lib/simulation/SimulationContext";
import { cn, getQualityColor, getQualityLabel, getTrendLabel } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, TrendingUp, Target, Signal } from "lucide-react";

export function DashboardStats() {
  const { currentScore, currentSample } = useSimulation();

  const stats = [
    {
      label: "Current ISI",
      value: currentScore?.score ?? "--",
      suffix: "/ 100",
      icon: Activity,
      accent: true,
    },
    {
      label: "Trend",
      value: currentScore ? getTrendLabel(currentScore.trend) : "--",
      prefix: currentScore?.trend === "increasing" ? "↑" : currentScore?.trend === "decreasing" ? "↓" : "→",
      icon: TrendingUp,
    },
    {
      label: "Baseline",
      value: currentScore?.baseline ?? "--",
      icon: Target,
    },
    {
      label: "Signal Quality",
      value: currentSample ? `${Math.round(currentSample.signalQuality.overall)}%` : "--",
      icon: Signal,
      quality: currentSample?.signalQuality.overall,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-navy-500">{stat.label}</p>
                  <p className={cn("mt-1 text-2xl font-bold", stat.accent ? "text-cardiac" : "text-navy-900")}>
                    {stat.prefix && <span className="mr-1">{stat.prefix}</span>}
                    {stat.value}
                    {stat.suffix && <span className="text-sm font-normal text-navy-400">{stat.suffix}</span>}
                  </p>
                </div>
                <div className={cn("p-2 rounded-lg", stat.accent ? "bg-red-50" : "bg-navy-50")}>
                  <Icon className={cn("w-4 h-4", stat.accent ? "text-cardiac" : "text-navy-600")} />
                </div>
              </div>
              {stat.quality !== undefined && (
                <p className={cn("mt-2 text-xs font-medium", getQualityColor(stat.quality))}>
                  {getQualityLabel(stat.quality)}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

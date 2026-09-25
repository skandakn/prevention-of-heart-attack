"use client";

import { useSimulation } from "@/lib/simulation/SimulationContext";
import { cn, getTrendLabel } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, TrendingUp, Target, Cpu, ShieldAlert, CheckCircle2, HeartPulse } from "lucide-react";

export function DashboardStats() {
  const { currentScore, currentSample, modelProbability, modelAlert, mlServiceStatus, baseline, healthRecord } = useSimulation();

  const prob = currentScore?.modelProbability ?? modelProbability ?? null;
  const isAlert = currentScore?.modelAlert ?? modelAlert ?? false;

  const hrValue = healthRecord?.restingHeartRate ?? baseline.restingHR;
  const bpSuffix = healthRecord?.systolicBP && healthRecord?.diastolicBP 
    ? ` · BP ${healthRecord.systolicBP}/${healthRecord.diastolicBP}`
    : "";

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
      value: currentScore?.baseline ?? baseline.isi,
      icon: Target,
    },
    {
      label: "Resting Vitals",
      value: `${hrValue} bpm`,
      suffix: bpSuffix,
      icon: HeartPulse,
    },
    {
      label: "ML Model (p_model)",
      value: prob !== null ? `${(prob * 100).toFixed(1)}%` : "--",
      suffix: "/ τ 15.67%",
      icon: Cpu,
      mlCard: true,
      isAlert,
      serviceStatus: mlServiceStatus,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className={cn("overflow-hidden", stat.isAlert ? "border-rose-300 bg-rose-50/30" : "")}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-navy-500">{stat.label}</p>
                  <p className={cn("mt-1 text-2xl font-bold", stat.accent ? "text-cardiac" : stat.isAlert ? "text-rose-700" : "text-navy-900")}>
                    {stat.prefix && <span className="mr-1">{stat.prefix}</span>}
                    {stat.value}
                    {stat.suffix && <span className="text-xs font-normal text-navy-400 ml-1">{stat.suffix}</span>}
                  </p>
                </div>
                <div className={cn("p-2 rounded-lg", stat.accent ? "bg-red-50" : stat.isAlert ? "bg-rose-100" : "bg-navy-50")}>
                  <Icon className={cn("w-4 h-4", stat.accent ? "text-cardiac" : stat.isAlert ? "text-rose-600" : "text-navy-600")} />
                </div>
              </div>
              {stat.label === "Resting Vitals" && (
                <p className="mt-2 text-xs font-medium text-emerald-600">
                  From Health Record
                </p>
              )}
              {stat.mlCard && (
                <div className="mt-2 flex items-center gap-1.5 text-xs font-medium">
                  {stat.isAlert ? (
                    <span className="text-rose-700 font-semibold inline-flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" /> ALERT (≥ 0.156742)
                    </span>
                  ) : (
                    <span className="text-emerald-700 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> NORMAL (&lt; 0.156742)
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

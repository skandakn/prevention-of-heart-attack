"use client";

import { useSimulation } from "@/lib/simulation/SimulationContext";
import { cn, getISILabel } from "@/lib/utils";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MEDICAL_DISCLAIMER } from "@/lib/isi/types";

interface ISIGaugeProps {
  score?: number;
  baseline?: number;
  trend?: string;
  confidence?: number;
  size?: "sm" | "lg";
}

export function ISIGauge({
  score: propScore,
  baseline: propBaseline,
  trend: propTrend,
  confidence: propConfidence,
  size = "lg",
}: ISIGaugeProps) {
  const { currentScore } = useSimulation();
  const score = propScore ?? currentScore?.score ?? 0;
  const baseline = propBaseline ?? currentScore?.baseline ?? 48;
  const trend = propTrend ?? currentScore?.trend ?? "stable";
  const confidence = propConfidence ?? currentScore?.confidence ?? 0;
  const deviation = score - baseline;

  const circumference = 2 * Math.PI * 88;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getScoreColor = (s: number) => {
    if (s <= 30) return "#10B981";
    if (s <= 60) return "#F59E0B";
    return "#DC2626";
  };

  const trendIcon = trend === "increasing" ? "↑" : trend === "decreasing" ? "↓" : "→";

  return (
    <div className="flex flex-col items-center">
      <div className={cn("relative", size === "lg" ? "w-52 h-52" : "w-36 h-36")}>
        <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="88" fill="none" stroke="#E2E8F0" strokeWidth="12" />
          <circle
            cx="100"
            cy="100"
            r="88"
            fill="none"
            stroke={getScoreColor(score)}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-bold text-navy-900", size === "lg" ? "text-5xl" : "text-3xl")}>
            {score}
          </span>
          <span className="text-sm font-medium text-navy-500">ISI</span>
        </div>
      </div>

      <p className="mt-3 text-sm font-medium text-navy-700">{getISILabel(score)}</p>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
        <div>
          <span className="text-navy-400">Personal baseline</span>
          <p className="font-semibold text-navy-900">{baseline}</p>
        </div>
        <div>
          <span className="text-navy-400">Current deviation</span>
          <p className={cn("font-semibold", deviation > 0 ? "text-cardiac" : "text-emerald-600")}>
            {deviation > 0 ? "+" : ""}{deviation}
          </p>
        </div>
        <div>
          <span className="text-navy-400">Trend</span>
          <p className="font-semibold text-navy-900 capitalize">{trendIcon} {trend}</p>
        </div>
        <div>
          <span className="text-navy-400">Confidence</span>
          <p className="font-semibold text-navy-900">{confidence}%</p>
        </div>
      </div>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger className="mt-3 flex items-center gap-1 text-xs text-navy-400 hover:text-navy-600">
            <Info className="w-3 h-3" />
            About ISI scoring
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>{MEDICAL_DISCLAIMER}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <p className="mt-2 text-[10px] text-navy-400 text-center max-w-xs">
        Illustrative prototype ranges — not clinically validated thresholds.
      </p>
    </div>
  );
}

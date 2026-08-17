"use client";

import { useMemo } from "react";
import { useSimulation } from "@/lib/simulation/SimulationContext";
import { generateWaveformPoints } from "@/lib/isi/simulation";
import { cn, getQualityLabel } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, YAxis } from "recharts";

interface SignalPanelProps {
  type: "ppg" | "ecg" | "spo2" | "imu";
  title: string;
  subtitle: string;
}

export function SignalPanel({ type, title, subtitle }: SignalPanelProps) {
  const { scenario, currentSample, isRunning } = useSimulation();

  const tick = currentSample?.timestamp ?? 0;
  const data = useMemo(
    () => generateWaveformPoints(type, scenario, 80, isRunning ? tick : undefined),
    [type, scenario, tick, isRunning]
  );

  const quality = currentSample?.signalQuality[type === "spo2" ? "spo2" : type] ?? 90;
  const isIMU = type === "imu";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">{title}</CardTitle>
            <p className="text-[10px] text-navy-400 mt-0.5">{subtitle}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-navy-400">{isIMU ? "Motion" : "Signal Quality"}</p>
            <p className={cn("text-xs font-semibold", quality >= 75 ? "text-emerald-600" : quality >= 50 ? "text-amber-600" : "text-cardiac")}>
              {isIMU ? (quality >= 75 ? "Low" : quality >= 50 ? "Moderate" : "High") : getQualityLabel(quality)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="h-24 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <YAxis domain={type === "spo2" ? [94, 99] : ["auto", "auto"]} hide />
              <Line
                type="monotone"
                dataKey="y"
                stroke={type === "ecg" ? "#DC2626" : type === "ppg" ? "#0F172A" : type === "spo2" ? "#3B82F6" : "#8B5CF6"}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={isRunning}
                animationDuration={300}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {isRunning && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-emerald-600">Live</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

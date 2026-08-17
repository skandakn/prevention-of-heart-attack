"use client";

import { useSimulation } from "@/lib/simulation/SimulationContext";
import type { ISIScore, PersonalBaseline } from "@/lib/isi/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";

interface ISITrendChartProps {
  history?: ISIScore[];
  baselineIsi?: number;
}

export function ISITrendChart({ history: historyProp, baselineIsi: baselineIsiProp }: ISITrendChartProps = {}) {
  const { history: simHistory, baseline } = useSimulation();
  const history = historyProp ?? simHistory;
  const baselineIsi = baselineIsiProp ?? baseline.isi;

  const data = history.slice(-60).map((score, i) => ({
    time: i,
    isi: score.score,
    baseline: baselineIsi,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">ISI Trend</CardTitle>
        <p className="text-xs text-navy-500">Personal baseline comparison over time</p>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="isiGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#DC2626" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#94A3B8" }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#94A3B8" }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: "white",
                  border: "1px solid #E2E8F0",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <ReferenceLine y={baselineIsi} stroke="#64748B" strokeDasharray="5 5" label={{ value: "Baseline", fontSize: 10, fill: "#64748B" }} />
              <ReferenceLine y={60} stroke="#F59E0B" strokeDasharray="3 3" strokeOpacity={0.5} />
              <Area
                type="monotone"
                dataKey="isi"
                stroke="#DC2626"
                strokeWidth={2}
                fill="url(#isiGradient)"
                dot={false}
                activeDot={{ r: 4, fill: "#DC2626" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useState, useMemo } from "react";
import { useSimulation } from "@/lib/simulation/SimulationContext";
import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import { Paywall } from "@/components/ui/Paywall";
import { generateTrendData } from "@/lib/isi/simulation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";

const timeFilters = [
  { id: "24h", label: "24 Hours", hours: 24 },
  { id: "7d", label: "7 Days", hours: 168 },
  { id: "30d", label: "30 Days", hours: 720 },
];

export default function TrendsPage() {
  const { scenario, timeline } = useSimulation();
  const { canAccessFeature } = useSubscription();
  const [filter, setFilter] = useState("24h");

  const hasAccess = canAccessFeature("LONG_TERM_TRENDS");

  const hours = timeFilters.find((f) => f.id === filter)?.hours ?? 24;
  const trendData = useMemo(() => generateTrendData(scenario, hours), [scenario, hours]);

  const charts = [
    { key: "isi", label: "ISI Trend", color: "#DC2626", domain: [0, 100] as [number, number] },
    { key: "hrv", label: "HRV Trend", color: "#0F172A", domain: [30, 60] as [number, number] },
    { key: "spo2", label: "SpO₂ Trend", color: "#3B82F6", domain: [94, 99] as [number, number] },
    { key: "heartRate", label: "Heart Rate", color: "#DC2626", domain: [60, 90] as [number, number] },
    { key: "motion", label: "Activity / Motion", color: "#8B5CF6", domain: [0, 100] as [number, number] },
  ];

  const eventColors: Record<string, string> = {
    normal: "bg-emerald-100 text-emerald-700",
    activity: "bg-blue-100 text-blue-700",
    isi_change: "bg-amber-100 text-amber-700",
    recovery: "bg-emerald-100 text-emerald-700",
    artifact: "bg-red-100 text-red-700",
  };

  const content = (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Long-term Trends</h1>
        <p className="text-sm text-navy-500">Historical physiological pattern analysis</p>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          {timeFilters.map((f) => (
            <TabsTrigger key={f.id} value={f.id}>{f.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid lg:grid-cols-2 gap-6">
        {charts.map((chart) => (
          <Card key={chart.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{chart.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#94A3B8" }} tickLine={false} interval="preserveStartEnd" />
                    <YAxis domain={chart.domain} tick={{ fontSize: 9, fill: "#94A3B8" }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: "11px", borderRadius: "8px" }} />
                    <Line type="monotone" dataKey={chart.key} stroke={chart.color} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Insight Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Insight Timeline</CardTitle>
          <p className="text-xs text-navy-500">Non-diagnostic event markers</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {timeline.map((event, i) => (
              <div key={i} className="flex items-start gap-4">
                <span className="text-sm font-mono font-semibold text-navy-900 w-14 shrink-0">{event.time}</span>
                <div className="flex-1">
                  <span className={cn("inline-block text-[10px] px-2 py-0.5 rounded-full font-medium mb-1", eventColors[event.type])}>
                    {event.type.replace("_", " ")}
                  </span>
                  <p className="text-sm text-navy-700">{event.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (!hasAccess) {
    return (
      <div className="p-4 lg:p-8 max-w-7xl mx-auto">
        <Paywall featureName="7-Day & 30-Day Long-Term Trends">
          {content}
        </Paywall>
      </div>
    );
  }

  return content;
}

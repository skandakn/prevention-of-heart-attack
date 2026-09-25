import os

content = '''"use client";

import { useState } from "react";
import { generatePatients } from "@/lib/isi/simulation";
import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import { Paywall } from "@/components/ui/Paywall";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DisclaimerBanner } from "@/components/layout/Footer";
import { SimulatedBadge } from "@/components/layout/Toast";
import { cn, getTrendLabel } from "@/lib/utils";
import { ISIGauge } from "@/components/isi/ISIGauge";
import { ContributionBars } from "@/components/isi/ContributionBars";
import { ISITrendChart } from "@/components/charts/ISITrendChart";
import { BaselineCard } from "@/components/isi/BaselineCard";
import { Download, ChevronRight, Cpu } from "lucide-react";
import type { PatientRecord } from "@/lib/isi/types";
import { MEDICAL_DISCLAIMER } from "@/lib/isi/types";

export default function ClinicianPage() {
  const { canAccessFeature } = useSubscription();
  const [patients] = useState<PatientRecord[]>(() => generatePatients());
  const [selected, setSelected] = useState<PatientRecord | null>(() => patients[0] ?? null);

  const hasAccess = canAccessFeature("ADVANCED_ANALYTICS");

  const exportReport = () => {
    const report = {
      generated: new Date().toISOString(),
      patient: selected?.id ?? "All",
      model_provenance: {
        model_name: "BeatAhead Phase 5 XGBoost",
        model_version: "1.0.0-phase5-frozen",
        schema_version: "1.0.0",
        feature_matrix: "26-feature Matrix A",
        decision_threshold: 0.156742,
        selection_metric: "F1 maximization",
        intended_use: "Research prototype for prospective early-warning trend analysis (300s window + 300s buffer + 300s horizon)",
        regulatory_status: "Investigational research prototype — Not FDA approved for diagnostic use",
        artifact_hash: "528ff3f8f5edac6f3baf5aef8715d5e86f478462d76ac574b9f0ec60e8640808",
      },
      disclaimer: MEDICAL_DISCLAIMER,
      note: "Clinical decision support prototype — not a diagnostic system.",
      data: selected ?? patients,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `beatahead-report-${selected?.id ?? "all"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const content = (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Clinician Dashboard</h1>
          <p className="text-sm text-navy-500">Clinical decision support prototype</p>
        </div>
        <div className="flex items-center gap-3">
          <SimulatedBadge />
          <Button onClick={exportReport} variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" /> Export Report
          </Button>
        </div>
      </div>

      <DisclaimerBanner />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
        <div>
          Clinical decision support prototype — not a diagnostic system. Supports clinical follow-up.
        </div>
        <div className="flex items-center gap-2 shrink-0 font-mono text-[11px] text-blue-900">
          <Cpu className="w-3.5 h-3.5" />
          <span>Model: BeatAhead Phase 5 XGBoost (τ = 0.156742)</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Patient list */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Patient List</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-navy-50">
              {patients.map((p) => {
                const isSelected = selected?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className={cn(
                      "w-full text-left p-4 hover:bg-navy-50/50 transition flex items-center justify-between",
                      isSelected && "bg-navy-50"
                    )}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-navy-900 text-sm">{p.id}</span>
                        <span className="text-xs text-navy-400">{p.age}y {p.gender}</span>
                      </div>
                      <p className="text-xs text-navy-500 mt-0.5 truncate">{p.condition}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs">
                        <span className="font-mono font-medium text-navy-700">ISI: {p.currentISI}</span>
                        <span className="text-navy-400">•</span>
                        <span className="text-navy-500">{getTrendLabel(p.trend)}</span>
                      </div>
                    </div>
                    <ChevronRight className={cn("w-4 h-4 text-navy-300", isSelected && "text-navy-700")} />
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Patient detail */}
        <div className="lg:col-span-2 space-y-6">
          {selected ? (
            <>
              <div className="grid sm:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Patient Overview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between py-1 border-b border-navy-50">
                      <span className="text-navy-500">ID</span>
                      <span className="font-semibold text-navy-900">{selected.id}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-navy-50">
                      <span className="text-navy-500">Demographics</span>
                      <span className="text-navy-700">{selected.age} yrs, {selected.gender}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-navy-50">
                      <span className="text-navy-500">Primary Indication</span>
                      <span className="text-navy-700">{selected.condition}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-navy-500">Signal Quality</span>
                      <span className="text-emerald-600 font-medium">{selected.signalQuality}%</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Current Status</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center p-4">
                    <ISIGauge score={selected.currentISI} size="sm" />
                  </CardContent>
                </Card>
              </div>

              <ISITrendChart />
              <ContributionBars />
              <BaselineCard />
            </>
          ) : (
            <Card className="p-8 text-center text-navy-400">
              Select a patient from the list to view clinical data
            </Card>
          )}
        </div>
      </div>
    </div>
  );

  return hasAccess ? content : <Paywall feature="ADVANCED_ANALYTICS">{content}</Paywall>;
}
'''

target_path = r"C:\ischemic\src\app\clinician\page.tsx"
with open(target_path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Successfully updated {target_path}")

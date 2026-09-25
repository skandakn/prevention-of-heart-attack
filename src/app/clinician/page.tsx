"use client";

import { useState } from "react";
import { generatePatients } from "@/lib/isi/simulation";
import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import { Paywall } from "@/components/ui/Paywall";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { cn, getTrendLabel } from "@/lib/utils";
import { ISIGauge } from "@/components/isi/ISIGauge";
import { ContributionBars } from "@/components/isi/ContributionBars";
import { ISITrendChart } from "@/components/charts/ISITrendChart";
import { BaselineCard } from "@/components/isi/BaselineCard";
import { Download, ChevronRight, Cpu, FileText } from "lucide-react";
import type { PatientRecord } from "@/lib/isi/types";
import { MEDICAL_DISCLAIMER } from "@/lib/isi/types";
import { generateClinicalPDF, generateCohortPDF } from "@/lib/pdf/generateClinicalReport";

export default function ClinicianPage() {
  const { canAccessFeature } = useSubscription();
  const [patients] = useState<PatientRecord[]>(() => generatePatients());
  const [selected, setSelected] = useState<PatientRecord | null>(() => patients[0] ?? null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const hasAccess = canAccessFeature("ADVANCED_ANALYTICS");

  const exportPDF = async () => {
    setIsExportingPdf(true);
    try {
      if (selected) {
        await generateClinicalPDF(selected);
      } else {
        await generateCohortPDF(patients);
      }
    } catch (err) {
      console.error("Failed to generate PDF report:", err);
    } finally {
      setIsExportingPdf(false);
    }
  };

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
        <div className="flex items-center gap-2">
          <Button
            onClick={exportPDF}
            disabled={isExportingPdf}
            size="sm"
            className="gap-2 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white shadow-sm font-medium"
          >
            <FileText className="w-4 h-4" />
            {isExportingPdf ? "Generating PDF..." : "Export PDF"}
          </Button>
          <Button
            onClick={exportReport}
            variant="outline"
            size="sm"
            className="gap-2 text-navy-700 border-navy-200 hover:bg-navy-50"
          >
            <Download className="w-4 h-4" />
            Export JSON
          </Button>
        </div>
      </div>

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
            <div className="divide-y divide-navy-100">
              {patients.map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => setSelected(patient)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 text-left hover:bg-navy-50 transition-colors",
                    selected?.id === patient.id && "bg-navy-50 border-l-2 border-navy-900"
                  )}
                >
                  <div>
                    <p className="text-sm font-semibold text-navy-900">{patient.id}</p>
                    <p className="text-xs text-navy-500">ISI: {patient.currentISI} · {getTrendLabel(patient.trend)}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-navy-400" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Patient detail */}
        <div className="lg:col-span-2 space-y-6">
          {selected ? (
            <>
              <div className="grid sm:grid-cols-4 gap-3">
                {[
                  { label: "Current ISI", value: selected.currentISI },
                  { label: "Trend", value: getTrendLabel(selected.trend) },
                  { label: "Signal Quality", value: `${Math.round(selected.signalQuality)}%` },
                  { label: "Last Updated", value: selected.lastUpdated },
                ].map((s) => (
                  <div key={s.label} className="p-3 rounded-lg bg-white border border-navy-100">
                    <p className="text-[10px] text-navy-400">{s.label}</p>
                    <p className="text-lg font-bold text-navy-900">{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="rounded-xl border border-navy-100 bg-white p-6">
                  <ISIGauge
                    score={selected.currentISI}
                    baseline={selected.baseline.isi}
                    trend={selected.trend}
                    confidence={selected.scores.at(-1)?.confidence ?? 86}
                  />
                </div>
                <BaselineCard
                  title="Patient Baseline"
                  baseline={selected.baseline}
                  sample={selected.lastSample}
                  features={selected.features}
                />
              </div>
              <ISITrendChart history={selected.scores} baselineIsi={selected.baseline.isi} />
              <ContributionBars contributions={selected.scores.at(-1)?.contributions} />
            </>
          ) : (
            <div className="flex items-center justify-center h-64 rounded-xl border border-dashed border-navy-200 bg-navy-50/50">
              <p className="text-sm text-navy-500">Select a patient to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (!hasAccess) {
    return (
      <div className="p-4 lg:p-8 max-w-7xl mx-auto">
        <Paywall featureName="Clinician Dashboard & Multi-Patient Analytics">
          {content}
        </Paywall>
      </div>
    );
  }

  return content;
}

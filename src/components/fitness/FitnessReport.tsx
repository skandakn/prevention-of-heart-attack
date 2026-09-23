"use client";

import { useRef, useState } from "react";
import { useFitRest } from "@/lib/fit-rest/FitRestContext";
import { Button } from "@/components/ui/button";
import { EXERCISE_TYPE_LABELS } from "@/lib/fit-rest/types";
import type { WorkoutSession } from "@/lib/fit-rest/types";
import { cn } from "@/lib/utils";
import { Printer, Calendar, FileText, ChevronDown } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatDisplay(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function intensityColor(intensity: WorkoutSession["intensity"]): string {
  if (intensity === "light") return "#16a34a";
  if (intensity === "moderate") return "#d97706";
  return "#dc2626";
}

// ─── Print logic ──────────────────────────────────────────────────────────────

function printReport(contentId: string) {
  const el = document.getElementById(contentId);
  if (!el) return;

  const printWindow = window.open("", "_blank", "width=800,height=700");
  if (!printWindow) return;

  // Pull in all stylesheets from the current page
  const styles = Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        return Array.from(sheet.cssRules)
          .map((rule) => rule.cssText)
          .join("\n");
      } catch {
        // Cross-origin stylesheets will throw — link them instead
        return sheet.href ? `@import url("${sheet.href}");` : "";
      }
    })
    .join("\n");

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>BeatAhead Fitness Report</title>
  <style>
    ${styles}
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    body { font-family: system-ui, sans-serif; background: white; margin: 0; padding: 24px; }
  </style>
</head>
<body>${el.innerHTML}</body>
</html>`);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 400);
}

// ─── Report content (rendered hidden, then printed) ──────────────────────────

function ReportContent({
  id,
  date,
  workouts,
  totalMinutes,
  intenseCounts,
}: {
  id: string;
  date: string;
  workouts: WorkoutSession[];
  totalMinutes: number;
  intenseCounts: Record<WorkoutSession["intensity"], number>;
}) {
  const generatedAt = new Date().toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div
      id={id}
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: 720,
        margin: "0 auto",
        padding: 32,
        color: "#1e2a3a",
        background: "white",
      }}
    >
      {/* Header */}
      <div style={{ borderBottom: "2px solid #dc2626", paddingBottom: 16, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1e2a3a" }}>
              BeatAhead Fitness Report
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "#64748b" }}>
              {formatDisplay(date)}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>Generated</p>
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{generatedAt}</p>
          </div>
        </div>
      </div>

      {workouts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8" }}>
          <p style={{ fontSize: 16, fontWeight: 600 }}>No workouts recorded for this date.</p>
          <p style={{ fontSize: 13, marginTop: 8 }}>Try selecting a different day.</p>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
            {[
              { label: "Total Sessions", value: String(workouts.length) },
              { label: "Total Minutes", value: String(totalMinutes) },
              {
                label: "Intensity Mix",
                value: [
                  intenseCounts.light > 0 ? `${intenseCounts.light} light` : "",
                  intenseCounts.moderate > 0 ? `${intenseCounts.moderate} moderate` : "",
                  intenseCounts.intense > 0 ? `${intenseCounts.intense} intense` : "",
                ].filter(Boolean).join(", ") || "—",
              },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "12px 16px",
                }}
              >
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {label}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 800, color: "#1e2a3a" }}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Workout table */}
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#1e2a3a", marginBottom: 10, marginTop: 0 }}>
            Workout Details
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                {["#", "Type", "Duration", "Intensity", "Notes"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "8px 12px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workouts.map((w, i) => (
                <tr
                  key={w.id}
                  style={{ background: i % 2 === 0 ? "white" : "#f8fafc", borderBottom: "1px solid #f1f5f9" }}
                >
                  <td style={{ padding: "9px 12px", color: "#94a3b8", fontWeight: 600 }}>{i + 1}</td>
                  <td style={{ padding: "9px 12px", fontWeight: 600 }}>{EXERCISE_TYPE_LABELS[w.type]}</td>
                  <td style={{ padding: "9px 12px" }}>{w.durationMinutes} min</td>
                  <td style={{ padding: "9px 12px" }}>
                    <span style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 99,
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "capitalize",
                      color: "white",
                      background: intensityColor(w.intensity),
                    }}>
                      {w.intensity}
                    </span>
                  </td>
                  <td style={{ padding: "9px 12px", color: "#64748b", fontStyle: "italic" }}>
                    {w.notes || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Footer */}
      <div style={{ marginTop: 36, paddingTop: 16, borderTop: "1px solid #e2e8f0", fontSize: 10, color: "#94a3b8", textAlign: "center" }}>
        BeatAhead Wellness Platform — This report is for personal wellness tracking only and does not constitute medical advice.
      </div>
    </div>
  );
}

// ─── Main exported component ──────────────────────────────────────────────────

export function FitnessReport() {
  const { workoutHistory } = useFitRest();

  const todayISO = toISO(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayISO);
  const [showPicker, setShowPicker] = useState(false);

  const REPORT_ID = "fitness-report-printable";

  // Filter workouts for the selected date
  const dayWorkouts = workoutHistory.filter((w) => w.date === selectedDate);
  const totalMinutes = dayWorkouts.reduce((s, w) => s + w.durationMinutes, 0);
  const intenseCounts = dayWorkouts.reduce(
    (acc, w) => { acc[w.intensity]++; return acc; },
    { light: 0, moderate: 0, intense: 0 } as Record<WorkoutSession["intensity"], number>
  );

  // Available dates (unique dates in history, newest first)
  const availableDates = Array.from(
    new Set(workoutHistory.map((w) => w.date))
  ).sort((a, b) => b.localeCompare(a));

  return (
    <>
      {/* ── Hidden printable content ─────────────────────────────────── */}
      <div style={{ position: "absolute", left: -9999, top: -9999, width: 760 }} aria-hidden>
        <ReportContent
          id={REPORT_ID}
          date={selectedDate}
          workouts={dayWorkouts}
          totalMinutes={totalMinutes}
          intenseCounts={intenseCounts}
        />
      </div>

      {/* ── Visible card — bold hero design ─────────────────────────── */}
      <div className="rounded-2xl overflow-hidden border border-navy-200 shadow-lg">

        {/* Hero banner */}
        <div className="bg-gradient-to-r from-navy-900 via-navy-800 to-blue-900 px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 border border-white/20">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white tracking-tight">Fitness Report</h3>
              <p className="text-xs text-blue-200 mt-0.5">Print a detailed summary of any workout day</p>
            </div>
          </div>

          {/* Big print button */}
          <Button
            onClick={() => printReport(REPORT_ID)}
            size="default"
            className="gap-2 bg-white text-navy-900 hover:bg-blue-50 font-bold shadow-lg shrink-0 px-5 py-2.5 text-sm"
          >
            <Printer className="h-4 w-4" />
            Print Report
          </Button>
        </div>

        {/* Body */}
        <div className="bg-white px-6 py-5 space-y-5">

          {/* ── Date selector ──────────────────────────────────────── */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-navy-700 uppercase tracking-widest">
              Select Date
            </label>
            <div className="flex gap-2 flex-wrap items-center">
              <button
                onClick={() => setSelectedDate(todayISO)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-bold transition-all",
                  selectedDate === todayISO
                    ? "bg-navy-900 text-white border-navy-900 shadow"
                    : "bg-white text-navy-600 border-navy-200 hover:border-navy-500 hover:bg-navy-50"
                )}
              >
                <Calendar className="h-3 w-3" />
                Today
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowPicker((p) => !p)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-bold transition-all",
                    selectedDate !== todayISO
                      ? "bg-navy-900 text-white border-navy-900 shadow"
                      : "bg-white text-navy-600 border-navy-200 hover:border-navy-500 hover:bg-navy-50"
                  )}
                >
                  <Calendar className="h-3 w-3" />
                  {selectedDate !== todayISO
                    ? new Date(selectedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "Pick a date"}
                  <ChevronDown className="h-3 w-3" />
                </button>

                {showPicker && (
                  <div className="absolute left-0 top-full mt-1 z-20 w-56 rounded-xl border border-navy-200 bg-white shadow-xl overflow-hidden">
                    <div className="p-3 border-b border-navy-100">
                      <input
                        type="date"
                        value={selectedDate}
                        max={todayISO}
                        onChange={(e) => { setSelectedDate(e.target.value); setShowPicker(false); }}
                        className="w-full text-xs rounded-lg border border-navy-200 px-2 py-1.5 text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900"
                      />
                    </div>
                    {availableDates.length > 0 && (
                      <div className="max-h-52 overflow-y-auto">
                        <p className="px-3 py-1.5 text-[10px] font-bold text-navy-400 uppercase tracking-wide">
                          Recorded dates
                        </p>
                        {availableDates.slice(0, 20).map((d) => (
                          <button
                            key={d}
                            onClick={() => { setSelectedDate(d); setShowPicker(false); }}
                            className={cn(
                              "w-full text-left px-3 py-2 text-xs hover:bg-navy-50 transition-colors flex items-center justify-between",
                              d === selectedDate ? "font-bold text-navy-900 bg-navy-50" : "text-navy-600"
                            )}
                          >
                            <span>{new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
                            {d === todayISO && <span className="text-emerald-600 font-bold text-[10px]">Today</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Preview panel ───────────────────────────────────────── */}
          {dayWorkouts.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-navy-200 py-8 text-center">
              <Printer className="h-8 w-8 text-navy-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-navy-500">No workouts on{" "}
                <span className="text-navy-700">
                  {selectedDate === todayISO ? "today" : new Date(selectedDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </p>
              <p className="text-xs text-navy-400 mt-1">Pick a date with recorded activity above.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-navy-200 overflow-hidden">
              {/* Preview header */}
              <div className="bg-navy-50 px-4 py-2.5 flex items-center justify-between border-b border-navy-200">
                <span className="text-xs font-bold text-navy-700 uppercase tracking-wide">
                  {selectedDate === todayISO ? "Today" : new Date(selectedDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </span>
                <div className="flex items-center gap-3 text-xs text-navy-500">
                  <span className="font-semibold text-navy-800">{dayWorkouts.length} {dayWorkouts.length === 1 ? "session" : "sessions"}</span>
                  <span>·</span>
                  <span className="font-semibold text-navy-800">{totalMinutes} min</span>
                </div>
              </div>
              {/* Workout rows */}
              <div className="divide-y divide-navy-100">
                {dayWorkouts.map((w) => (
                  <div key={w.id} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm font-semibold text-navy-800">{EXERCISE_TYPE_LABELS[w.type]}</span>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs text-navy-500 font-medium">{w.durationMinutes} min</span>
                      <span className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize",
                        w.intensity === "light" && "bg-emerald-100 text-emerald-700",
                        w.intensity === "moderate" && "bg-amber-100 text-amber-700",
                        w.intensity === "intense" && "bg-red-100 text-red-700",
                      )}>
                        {w.intensity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom CTA — repeat print button prominently */}
          <Button
            onClick={() => printReport(REPORT_ID)}
            size="default"
            className="w-full gap-2 font-bold text-sm py-3"
            disabled={dayWorkouts.length === 0}
          >
            <Printer className="h-4 w-4" />
            {dayWorkouts.length === 0
              ? "No data to print"
              : `Print ${dayWorkouts.length === 1 ? "1 Session" : `${dayWorkouts.length} Sessions`} — ${totalMinutes} min`}
          </Button>
        </div>
      </div>
    </>
  );
}

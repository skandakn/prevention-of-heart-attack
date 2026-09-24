"use client";

import { useState } from "react";
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

// ─── Shared print helper — iframe approach (no popup, no stylesheet issues) ──

function buildPrintHTML(title: string, bodyHTML: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      background: white;
      color: #1e2a3a;
      padding: 32px;
      font-size: 13px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    h1 { font-size: 22px; font-weight: 800; margin: 0; }
    h2 { font-size: 14px; font-weight: 700; margin: 0 0 10px; }
    p  { margin: 0; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 8px 12px; text-align: left; }
    thead tr { background: #f1f5f9; }
    th { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;
         letter-spacing: 0.04em; border-bottom: 1px solid #e2e8f0; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody tr { border-bottom: 1px solid #f1f5f9; }
    .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 28px; }
    .stat-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; }
    .stat-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
    .stat-value { font-size: 18px; font-weight: 800; color: #1e2a3a; margin-top: 4px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11px;
             font-weight: 700; text-transform: capitalize; color: white; }
    .header { border-bottom: 2px solid #dc2626; padding-bottom: 16px; margin-bottom: 24px;
              display: flex; justify-content: space-between; align-items: flex-start; }
    .header-right { text-align: right; font-size: 11px; color: #94a3b8; }
    .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0;
              font-size: 10px; color: #94a3b8; text-align: center; }
    .empty { text-align: center; padding: 48px 0; color: #94a3b8; }
    .section-header { background: #1e2a3a; color: white; padding: 10px 14px;
                      font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .msg-user { background: #1e2a3a; color: white; padding: 10px 14px; border-radius: 10px;
                margin: 6px 0; max-width: 88%; margin-left: auto; }
    .msg-agent { background: #f0fdf4; border: 1px solid #bbf7d0; color: #1e2a3a;
                 padding: 10px 14px; border-radius: 10px; margin: 6px 0; max-width: 88%; }
    .msg-role { font-size: 10px; font-weight: 700; text-transform: uppercase;
                letter-spacing: 0.05em; margin-bottom: 4px; }
    .msg-time { font-size: 10px; margin-top: 6px; opacity: 0.6; }
    .two-col { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 28px; }
  </style>
</head>
<body>${bodyHTML}</body>
</html>`;
}

function printViaIframe(html: string) {
  // Remove any existing print iframe
  const existing = document.getElementById("beatahead-print-iframe");
  if (existing) existing.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "beatahead-print-iframe";
  iframe.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;border:none;opacity:0;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(html);
  doc.close();

  // Wait for images/fonts then print
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      // Clean up after print dialog closes
      setTimeout(() => iframe.remove(), 2000);
    }, 250);
  };
}

// ─── Build report HTML string ─────────────────────────────────────────────────

function buildFitnessReportHTML(
  date: string,
  workouts: WorkoutSession[],
  totalMinutes: number,
  intenseCounts: Record<WorkoutSession["intensity"], number>
): string {
  const generatedAt = new Date().toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const workoutsHTML = workouts.length === 0
    ? `<div class="empty"><p style="font-size:16px;font-weight:600">No workouts recorded for this date.</p></div>`
    : `
      <div class="stat-grid">
        <div class="stat-box"><p class="stat-label">Total Sessions</p><p class="stat-value">${workouts.length}</p></div>
        <div class="stat-box"><p class="stat-label">Total Minutes</p><p class="stat-value">${totalMinutes}</p></div>
        <div class="stat-box"><p class="stat-label">Intensity Mix</p><p class="stat-value" style="font-size:13px;margin-top:6px">${[
          intenseCounts.light > 0 ? `${intenseCounts.light} light` : "",
          intenseCounts.moderate > 0 ? `${intenseCounts.moderate} moderate` : "",
          intenseCounts.intense > 0 ? `${intenseCounts.intense} intense` : "",
        ].filter(Boolean).join(", ") || "—"}</p></div>
      </div>
      <h2>Workout Details</h2>
      <table>
        <thead><tr><th>#</th><th>Type</th><th>Duration</th><th>Intensity</th><th>Notes</th></tr></thead>
        <tbody>
          ${workouts.map((w, i) => `
            <tr>
              <td style="color:#94a3b8;font-weight:600">${i + 1}</td>
              <td style="font-weight:600">${EXERCISE_TYPE_LABELS[w.type]}</td>
              <td>${w.durationMinutes} min</td>
              <td><span class="badge" style="background:${intensityColor(w.intensity)}">${w.intensity}</span></td>
              <td style="color:#64748b;font-style:italic">${w.notes ?? "—"}</td>
            </tr>`).join("")}
        </tbody>
      </table>`;

  const body = `
    <div class="header">
      <div>
        <h1>BeatAhead Fitness Report</h1>
        <p style="margin-top:4px;color:#64748b;font-size:14px">${formatDisplay(date)}</p>
      </div>
      <div class="header-right">
        <p>Generated</p>
        <p style="color:#64748b">${generatedAt}</p>
      </div>
    </div>
    ${workoutsHTML}
    <div class="footer">BeatAhead Wellness Platform — This report is for personal wellness tracking only and does not constitute medical advice.</div>`;

  return buildPrintHTML("BeatAhead Fitness Report", body);
}

// ─── Main exported component ──────────────────────────────────────────────────

export function FitnessReport() {
  const { workoutHistory } = useFitRest();

  const todayISO = toISO(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayISO);
  const [showPicker, setShowPicker] = useState(false);

  const REPORT_ID = "fitness-report-printable"; // kept for legacy, unused now

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
            onClick={() => printViaIframe(buildFitnessReportHTML(selectedDate, dayWorkouts, totalMinutes, intenseCounts))}
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
            onClick={() => printViaIframe(buildFitnessReportHTML(selectedDate, dayWorkouts, totalMinutes, intenseCounts))}
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

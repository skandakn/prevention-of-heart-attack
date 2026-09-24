"use client";

import { useState } from "react";
import { useFitRest } from "@/lib/fit-rest/FitRestContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SleepSession } from "@/lib/fit-rest/types";
import { cn } from "@/lib/utils";
import { Printer, Calendar, FileText, ChevronDown, Moon } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatDisplay(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function qualityColor(q: SleepSession["quality"]): string {
  if (q === "excellent") return "#16a34a";
  if (q === "good") return "#2563eb";
  if (q === "fair") return "#d97706";
  return "#dc2626";
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

// ─── Shared print CSS ─────────────────────────────────────────────────────────

const PRINT_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    background: white; color: #1e2a3a; padding: 32px; font-size: 13px; line-height: 1.5;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
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
  .header { border-bottom: 2px solid #4f46e5; padding-bottom: 16px; margin-bottom: 24px;
            display: flex; justify-content: space-between; align-items: flex-start; }
  .header-right { text-align: right; font-size: 11px; color: #94a3b8; }
  .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0;
            font-size: 10px; color: #94a3b8; text-align: center; }
  .empty { text-align: center; padding: 48px 0; color: #94a3b8; }
`;

// ─── iframe print helper ──────────────────────────────────────────────────────

function printViaIframe(html: string) {
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

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 2000);
    }, 250);
  };
}

// ─── Build HTML ───────────────────────────────────────────────────────────────

function buildRestReportHTML(
  date: string,
  sessions: SleepSession[],
  targetSleepHours: number
): string {
  const generatedAt = new Date().toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const totalHours = sessions.reduce((s, e) => s + e.hoursSlept, 0);
  const avgHours = sessions.length > 0 ? (totalHours / sessions.length).toFixed(1) : "0";

  const bodyHTML = sessions.length === 0
    ? `<div class="empty"><p style="font-size:16px;font-weight:600">No sleep data recorded for this date.</p></div>`
    : `
      <div class="stat-grid">
        <div class="stat-box"><p class="stat-label">Sessions</p><p class="stat-value">${sessions.length}</p></div>
        <div class="stat-box"><p class="stat-label">Avg Hours Slept</p><p class="stat-value">${avgHours}h</p></div>
        <div class="stat-box"><p class="stat-label">Target</p><p class="stat-value">${targetSleepHours}h</p></div>
      </div>
      <h2>Sleep Details</h2>
      <table>
        <thead><tr><th>#</th><th>Bedtime</th><th>Wake Time</th><th>Hours Slept</th><th>Quality</th><th>Notes</th></tr></thead>
        <tbody>
          ${sessions.map((s, i) => `
            <tr>
              <td style="color:#94a3b8;font-weight:600">${i + 1}</td>
              <td>${formatTime(s.bedtime)}</td>
              <td>${formatTime(s.wakeTime)}</td>
              <td style="font-weight:600">${s.hoursSlept}h</td>
              <td><span class="badge" style="background:${qualityColor(s.quality)}">${s.quality}</span></td>
              <td style="color:#64748b;font-style:italic">${s.notes ?? "—"}</td>
            </tr>`).join("")}
        </tbody>
      </table>`;

  const body = `
    <div class="header">
      <div>
        <h1>BeatAhead Sleep Report</h1>
        <p style="margin-top:4px;color:#64748b;font-size:14px">${formatDisplay(date)}</p>
      </div>
      <div class="header-right">
        <p>Generated</p>
        <p style="color:#64748b">${generatedAt}</p>
      </div>
    </div>
    ${bodyHTML}
    <div class="footer">BeatAhead Wellness Platform — This report is for personal wellness tracking only and does not constitute medical advice.</div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>BeatAhead Sleep Report</title>
<style>${PRINT_CSS}</style></head><body>${body}</body></html>`;
}

// ─── Main exported component ──────────────────────────────────────────────────

export function RestReport() {
  const { sleepHistory, restProfile } = useFitRest();

  const todayISO = toISO(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayISO);
  const [showPicker, setShowPicker] = useState(false);

  const daySessions = sleepHistory.filter((s) => s.date === selectedDate);

  const availableDates = Array.from(
    new Set(sleepHistory.map((s) => s.date))
  ).sort((a, b) => b.localeCompare(a));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-600" />
          <CardTitle className="text-base">Print Sleep Report</CardTitle>
        </div>
        <CardDescription>Generate a printable summary of your sleep data for any day.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Date selector */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-semibold text-navy-700 uppercase tracking-wide">Report Date</label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedDate(todayISO)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                  selectedDate === todayISO ? "bg-indigo-700 text-white border-indigo-700" : "bg-white text-navy-600 border-navy-200 hover:border-navy-400"
                )}
              >
                <Calendar className="h-3 w-3" /> Today
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowPicker((p) => !p)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                    selectedDate !== todayISO ? "bg-indigo-700 text-white border-indigo-700" : "bg-white text-navy-600 border-navy-200 hover:border-navy-400"
                  )}
                >
                  <Calendar className="h-3 w-3" />
                  {selectedDate !== todayISO
                    ? new Date(selectedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "Pick a date"}
                  <ChevronDown className="h-3 w-3" />
                </button>

                {showPicker && (
                  <div className="absolute left-0 top-full mt-1 z-20 w-52 rounded-xl border border-navy-200 bg-white shadow-lg overflow-hidden">
                    <div className="p-3 border-b border-navy-100">
                      <input
                        type="date"
                        value={selectedDate}
                        max={todayISO}
                        onChange={(e) => { setSelectedDate(e.target.value); setShowPicker(false); }}
                        className="w-full text-xs rounded-lg border border-navy-200 px-2 py-1.5 text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    {availableDates.length > 0 && (
                      <div className="max-h-48 overflow-y-auto">
                        <p className="px-3 py-1.5 text-[10px] font-bold text-navy-400 uppercase tracking-wide">Recorded dates</p>
                        {availableDates.slice(0, 20).map((d) => (
                          <button key={d} onClick={() => { setSelectedDate(d); setShowPicker(false); }}
                            className={cn("w-full text-left px-3 py-2 text-xs hover:bg-navy-50 transition-colors", d === selectedDate ? "font-bold text-navy-900 bg-navy-50" : "text-navy-600")}>
                            {new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                            {d === todayISO && <span className="ml-1 text-emerald-600 font-semibold">(Today)</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <Button
            onClick={() => printViaIframe(buildRestReportHTML(selectedDate, daySessions, restProfile.targetSleepHours))}
            className="gap-2 shrink-0 bg-indigo-700 hover:bg-indigo-800"
            size="sm"
          >
            <Printer className="h-4 w-4" /> Print Report
          </Button>
        </div>

        {/* Preview */}
        <div className={cn("rounded-xl border p-4", daySessions.length > 0 ? "border-navy-200 bg-navy-50/50" : "border-dashed border-navy-200")}>
          {daySessions.length === 0 ? (
            <p className="text-xs text-navy-400 text-center py-2">
              No sleep data for{" "}
              <span className="font-semibold text-navy-600">
                {selectedDate === todayISO ? "today" : new Date(selectedDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-navy-700">
                {selectedDate === todayISO ? "Today" : new Date(selectedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {" · "}{daySessions.length} {daySessions.length === 1 ? "session" : "sessions"}
              </p>
              {daySessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-xs">
                  <span className="text-navy-700 font-medium flex items-center gap-1">
                    <Moon className="h-3 w-3 text-indigo-500" />
                    {formatTime(s.bedtime)} → {formatTime(s.wakeTime)}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-navy-500">{s.hoursSlept}h</span>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold capitalize",
                      s.quality === "excellent" && "bg-emerald-100 text-emerald-700",
                      s.quality === "good" && "bg-blue-100 text-blue-700",
                      s.quality === "fair" && "bg-amber-100 text-amber-700",
                      s.quality === "poor" && "bg-red-100 text-red-700",
                    )}>{s.quality}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

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

// ─── Print logic ──────────────────────────────────────────────────────────────

function printReport(contentId: string) {
  const el = document.getElementById(contentId);
  if (!el) return;
  const printWindow = window.open("", "_blank", "width=800,height=700");
  if (!printWindow) return;
  const styles = Array.from(document.styleSheets).map((s) => {
    try { return Array.from(s.cssRules).map((r) => r.cssText).join("\n"); }
    catch { return s.href ? `@import url("${s.href}");` : ""; }
  }).join("\n");
  printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>BeatAhead Sleep Report</title>
<style>${styles} body{font-family:system-ui,sans-serif;background:white;margin:0;padding:24px;}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style>
</head><body>${el.innerHTML}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); printWindow.close(); }, 400);
}

// ─── Report HTML (rendered offscreen, sent to print window) ──────────────────

function ReportContent({
  id, date, sessions, restProfile,
}: {
  id: string;
  date: string;
  sessions: SleepSession[];
  restProfile: { targetSleepHours: number; typicalBedtime: string; typicalWakeTime: string };
}) {
  const generatedAt = new Date().toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const totalHours = sessions.reduce((s, e) => s + e.hoursSlept, 0);
  const avgHours = sessions.length > 0 ? (totalHours / sessions.length).toFixed(1) : "0";

  return (
    <div id={id} style={{ fontFamily: "system-ui,sans-serif", maxWidth: 720, margin: "0 auto", padding: 32, color: "#1e2a3a", background: "white" }}>
      {/* Header */}
      <div style={{ borderBottom: "2px solid #4f46e5", paddingBottom: 16, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>BeatAhead Sleep Report</h1>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "#64748b" }}>{formatDisplay(date)}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>Generated</p>
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{generatedAt}</p>
          </div>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8" }}>
          <p style={{ fontSize: 16, fontWeight: 600 }}>No sleep data recorded for this date.</p>
          <p style={{ fontSize: 13, marginTop: 8 }}>Try selecting a different day.</p>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
            {[
              { label: "Sessions", value: String(sessions.length) },
              { label: "Avg Hours Slept", value: `${avgHours}h` },
              { label: "Target", value: `${restProfile.targetSleepHours}h` },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 16px" }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
                <p style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 800, color: "#1e2a3a" }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Sleep sessions table */}
          <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, marginTop: 0 }}>Sleep Details</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                {["#", "Bedtime", "Wake Time", "Hours Slept", "Quality", "Notes"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => (
                <tr key={s.id} style={{ background: i % 2 === 0 ? "white" : "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "9px 12px", color: "#94a3b8", fontWeight: 600 }}>{i + 1}</td>
                  <td style={{ padding: "9px 12px" }}>{formatTime(s.bedtime)}</td>
                  <td style={{ padding: "9px 12px" }}>{formatTime(s.wakeTime)}</td>
                  <td style={{ padding: "9px 12px", fontWeight: 600 }}>{s.hoursSlept}h</td>
                  <td style={{ padding: "9px 12px" }}>
                    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 700, textTransform: "capitalize", color: "white", background: qualityColor(s.quality) }}>
                      {s.quality}
                    </span>
                  </td>
                  <td style={{ padding: "9px 12px", color: "#64748b", fontStyle: "italic" }}>{s.notes || "—"}</td>
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

export function RestReport() {
  const { sleepHistory, restProfile } = useFitRest();

  const todayISO = toISO(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayISO);
  const [showPicker, setShowPicker] = useState(false);

  const REPORT_ID = "rest-report-printable";

  const daySessions = sleepHistory.filter((s) => s.date === selectedDate);

  const availableDates = Array.from(
    new Set(sleepHistory.map((s) => s.date))
  ).sort((a, b) => b.localeCompare(a));

  return (
    <>
      {/* Hidden printable content */}
      <div style={{ position: "absolute", left: -9999, top: -9999, width: 760 }} aria-hidden>
        <ReportContent id={REPORT_ID} date={selectedDate} sessions={daySessions} restProfile={restProfile} />
      </div>

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

            <Button onClick={() => printReport(REPORT_ID)} className="gap-2 shrink-0 bg-indigo-700 hover:bg-indigo-800" size="sm">
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
    </>
  );
}

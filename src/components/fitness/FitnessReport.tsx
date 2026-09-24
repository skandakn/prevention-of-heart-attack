"use client";

import { useState } from "react";
import { useFitRest } from "@/lib/fit-rest/FitRestContext";
import { useSimulation } from "@/lib/simulation/SimulationContext";
import { Button } from "@/components/ui/button";
import {
  EXERCISE_TYPE_LABELS,
  FITNESS_GOAL_LABELS,
  EXERCISE_TYPE_LABELS as ACT_LABELS,
  EQUIPMENT_LABELS,
  FITNESS_LEVEL_LABELS,
} from "@/lib/fit-rest/types";
import type { WorkoutSession } from "@/lib/fit-rest/types";
import { cn } from "@/lib/utils";
import { Printer, Calendar, FileText, ChevronDown } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISO(d: Date) { return d.toISOString().split("T")[0]; }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function iColor(i: WorkoutSession["intensity"]) {
  return i === "light" ? "#16a34a" : i === "moderate" ? "#d97706" : "#dc2626";
}

// ─── Shared CSS ───────────────────────────────────────────────────────────────

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         background: #fff; color: #1e2a3a; padding: 28px; font-size: 13px; line-height: 1.5;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h1  { font-size: 21px; font-weight: 800; }
  h2  { font-size: 13px; font-weight: 700; margin: 22px 0 8px; text-transform: uppercase;
        letter-spacing: .05em; color: #475569; }
  p   { margin: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th, td { padding: 7px 11px; text-align: left; }
  thead tr { background: #f1f5f9; }
  th  { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;
        letter-spacing: .04em; border-bottom: 1px solid #e2e8f0; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tbody tr { border-bottom: 1px solid #f1f5f9; }

  .doc-header { border-bottom: 2px solid #dc2626; padding-bottom: 14px; margin-bottom: 20px;
                display: flex; justify-content: space-between; align-items: flex-start; }
  .doc-header-right { text-align: right; font-size: 11px; color: #94a3b8; }

  .grid4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 6px; }
  .grid3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-bottom: 6px; }
  .grid2 { display: grid; grid-template-columns: repeat(2,1fr); gap: 10px; margin-bottom: 6px; }
  .stat  { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 13px; }
  .stat-label { font-size: 9.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; }
  .stat-value { font-size: 19px; font-weight: 800; color: #1e2a3a; margin-top: 2px; }
  .stat-unit  { font-size: 11px; color: #64748b; }

  .isi-bar { height: 8px; border-radius: 99px; background: #e2e8f0; margin: 6px 0 2px; overflow: hidden; }
  .isi-fill { height: 100%; border-radius: 99px; }

  .badge  { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11px;
            font-weight: 700; text-transform: capitalize; color: white; }
  .tag    { display: inline-block; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px;
            padding: 2px 7px; font-size: 11px; color: #475569; margin: 2px 3px 2px 0; }
  .section-box { border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; margin-bottom: 4px; }
  .section-box-header { background: #f8fafc; padding: 8px 13px; font-size: 11px; font-weight: 700;
                        color: #475569; border-bottom: 1px solid #e2e8f0; }
  .section-box-body { padding: 12px 13px; }
  .info-row { display: flex; justify-content: space-between; padding: 5px 0;
              border-bottom: 1px solid #f1f5f9; font-size: 12.5px; }
  .info-row:last-child { border-bottom: none; }
  .info-key { color: #64748b; }
  .info-val { font-weight: 600; color: #1e2a3a; text-align: right; max-width: 60%; }
  .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e2e8f0;
            font-size: 9.5px; color: #94a3b8; text-align: center; }
  .disclaimer { background: #fef9c3; border: 1px solid #fde047; border-radius: 8px;
                padding: 8px 12px; font-size: 10px; color: #713f12; margin-top: 12px; }
`;

// ─── iframe print ─────────────────────────────────────────────────────────────

function printViaIframe(html: string) {
  const existing = document.getElementById("beatahead-print-iframe");
  if (existing) existing.remove();
  const iframe = document.createElement("iframe");
  iframe.id = "beatahead-print-iframe";
  iframe.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;border:none;opacity:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) return;
  doc.open(); doc.write(html); doc.close();
  iframe.onload = () => {
    setTimeout(() => { iframe.contentWindow?.focus(); iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 2000); }, 250);
  };
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

interface ReportData {
  date: string;
  workouts: WorkoutSession[];
  totalMinutes: number;
  recovery: {
    workoutCount: number; intenseWorkoutCount: number; totalWorkoutMinutes: number;
    avgSleepHours: number; sleepConsistencyPercent: number; sleepDebtHours: number;
    recentWorkoutSummary: string; recentSleepSummary: string;
  };
  fitnessProfile: {
    fitnessLevel: string; experienceMonths: number; goals: string[]; preferredActivities: string[];
    workoutsPerWeek: number; availableTimeMinutes: number; availableEquipment: string[];
    isProfileComplete: boolean;
  };
  isi: { score: number; label: string; trend: string; hrv: number; heartRate: number; spo2: number; signalQuality: number; };
}

function isiBarColor(score: number) {
  if (score < 30) return "#16a34a";
  if (score < 60) return "#f59e0b";
  return "#dc2626";
}

function buildFitnessReport(d: ReportData): string {
  const gen = new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

  // ── Wellness indicator section
  const isiPct = Math.min(100, Math.round(d.isi.score));
  const wellnessHTML = `
    <h2>Wellness Indicator (at time of report)</h2>
    <div class="section-box">
      <div class="section-box-header">ISI Platform — Research Prototype · Not clinically validated</div>
      <div class="section-box-body">
        <div class="grid4">
          <div class="stat"><p class="stat-label">ISI Score</p><p class="stat-value">${d.isi.score.toFixed(1)}</p><p class="stat-unit">${d.isi.label}</p></div>
          <div class="stat"><p class="stat-label">Trend</p><p class="stat-value" style="font-size:15px;margin-top:4px;text-transform:capitalize">${d.isi.trend}</p></div>
          <div class="stat"><p class="stat-label">Heart Rate</p><p class="stat-value">${Math.round(d.isi.heartRate)}<span class="stat-unit"> bpm</span></p></div>
          <div class="stat"><p class="stat-label">HRV (SDNN)</p><p class="stat-value">${Math.round(d.isi.hrv)}<span class="stat-unit"> ms</span></p></div>
        </div>
        <div class="grid2" style="margin-top:8px">
          <div class="stat"><p class="stat-label">SpO₂</p><p class="stat-value">${d.isi.spo2.toFixed(1)}<span class="stat-unit">%</span></p></div>
          <div class="stat"><p class="stat-label">Signal Quality</p><p class="stat-value">${Math.round(d.isi.signalQuality)}<span class="stat-unit">%</span></p></div>
        </div>
        <div class="isi-bar"><div class="isi-fill" style="width:${isiPct}%;background:${isiBarColor(d.isi.score)}"></div></div>
        <p style="font-size:10px;color:#94a3b8">ISI ${d.isi.score.toFixed(1)} / 100 — ${d.isi.label}</p>
      </div>
    </div>`;

  // ── Recovery stats
  const recoveryHTML = `
    <h2>7-Day Recovery Summary</h2>
    <div class="grid3">
      <div class="stat"><p class="stat-label">Workouts</p><p class="stat-value">${d.recovery.workoutCount}</p><p class="stat-unit">last 7 days</p></div>
      <div class="stat"><p class="stat-label">Active Minutes</p><p class="stat-value">${d.recovery.totalWorkoutMinutes}</p><p class="stat-unit">last 7 days</p></div>
      <div class="stat"><p class="stat-label">Intense Sessions</p><p class="stat-value">${d.recovery.intenseWorkoutCount}</p><p class="stat-unit">moderate + intense</p></div>
    </div>
    <div class="grid3">
      <div class="stat"><p class="stat-label">Avg Sleep</p><p class="stat-value">${d.recovery.avgSleepHours.toFixed(1)}<span class="stat-unit">h</span></p></div>
      <div class="stat"><p class="stat-label">Sleep Consistency</p><p class="stat-value">${d.recovery.sleepConsistencyPercent}<span class="stat-unit">%</span></p></div>
      <div class="stat"><p class="stat-label">Sleep Debt</p><p class="stat-value">${d.recovery.sleepDebtHours.toFixed(1)}<span class="stat-unit">h</span></p></div>
    </div>`;

  // ── Fitness profile
  const profileHTML = !d.fitnessProfile.isProfileComplete ? `<p style="color:#94a3b8;font-style:italic">Profile not yet completed.</p>` : `
    <div class="section-box">
      <div class="section-box-body">
        <div class="info-row"><span class="info-key">Level</span><span class="info-val">${FITNESS_LEVEL_LABELS[d.fitnessProfile.fitnessLevel as keyof typeof FITNESS_LEVEL_LABELS] ?? d.fitnessProfile.fitnessLevel}</span></div>
        <div class="info-row"><span class="info-key">Experience</span><span class="info-val">${d.fitnessProfile.experienceMonths} months</span></div>
        <div class="info-row"><span class="info-key">Workouts/week</span><span class="info-val">${d.fitnessProfile.workoutsPerWeek}</span></div>
        <div class="info-row"><span class="info-key">Time/session</span><span class="info-val">${d.fitnessProfile.availableTimeMinutes} min</span></div>
        <div class="info-row"><span class="info-key">Goals</span><span class="info-val">${d.fitnessProfile.goals.map(g => FITNESS_GOAL_LABELS[g as keyof typeof FITNESS_GOAL_LABELS] ?? g).join(", ") || "—"}</span></div>
        <div class="info-row"><span class="info-key">Activities</span><span class="info-val">${d.fitnessProfile.preferredActivities.map(a => ACT_LABELS[a as keyof typeof ACT_LABELS] ?? a).join(", ") || "—"}</span></div>
        <div class="info-row"><span class="info-key">Equipment</span><span class="info-val">${d.fitnessProfile.availableEquipment.map(e => EQUIPMENT_LABELS[e as keyof typeof EQUIPMENT_LABELS] ?? e).join(", ") || "—"}</span></div>
      </div>
    </div>`;

  // ── Day workouts table
  const workoutsHTML = d.workouts.length === 0
    ? `<div style="text-align:center;padding:28px 0;color:#94a3b8"><p style="font-weight:600">No workouts logged on this date.</p></div>`
    : `
    <div class="grid3" style="margin-bottom:12px">
      <div class="stat"><p class="stat-label">Sessions</p><p class="stat-value">${d.workouts.length}</p></div>
      <div class="stat"><p class="stat-label">Total Minutes</p><p class="stat-value">${d.totalMinutes}</p></div>
      <div class="stat"><p class="stat-label">Avg Duration</p><p class="stat-value">${Math.round(d.totalMinutes / d.workouts.length)}<span class="stat-unit"> min</span></p></div>
    </div>
    <table>
      <thead><tr><th>#</th><th>Type</th><th>Duration</th><th>Intensity</th><th>Source</th><th>Notes</th></tr></thead>
      <tbody>${d.workouts.map((w, i) => `
        <tr>
          <td style="color:#94a3b8;font-weight:600">${i + 1}</td>
          <td style="font-weight:600">${EXERCISE_TYPE_LABELS[w.type] ?? w.type}</td>
          <td>${w.durationMinutes} min</td>
          <td><span class="badge" style="background:${iColor(w.intensity)}">${w.intensity}</span></td>
          <td style="font-size:11px;color:#64748b">${w.id.startsWith("gfit_") ? "Google Fit" : w.isDemoData ? "Demo" : "Manual"}</td>
          <td style="color:#64748b;font-style:italic">${w.notes ?? "—"}</td>
        </tr>`).join("")}
      </tbody>
    </table>`;

  const body = `
    <div class="doc-header">
      <div><h1>BeatAhead Fitness Report</h1><p style="color:#64748b;font-size:13px;margin-top:4px">${fmtDate(d.date)}</p></div>
      <div class="doc-header-right"><p>Generated</p><p style="color:#475569">${gen}</p></div>
    </div>
    ${wellnessHTML}
    ${recoveryHTML}
    <h2>Fitness Profile</h2>${profileHTML}
    <h2>Workouts on ${fmtDate(d.date)}</h2>${workoutsHTML}
    <div class="disclaimer">⚠️ This report is for personal wellness tracking only. Wellness indicator data comes from a research prototype and is not clinically validated. Not a substitute for medical advice.</div>
    <div class="footer">BeatAhead ISI Platform · ${gen}</div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>BeatAhead Fitness Report</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FitnessReport() {
  const { workoutHistory, recoveryState, fitnessProfile } = useFitRest();
  const { currentSample, currentScore, scenario } = useSimulation();

  const todayISO = toISO(new Date());
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [showPicker, setShowPicker] = useState(false);

  const dayWorkouts = workoutHistory.filter((w) => w.date === selectedDate);
  const totalMinutes = dayWorkouts.reduce((s, w) => s + w.durationMinutes, 0);
  const intenseCounts = dayWorkouts.reduce(
    (acc, w) => { acc[w.intensity]++; return acc; },
    { light: 0, moderate: 0, intense: 0 } as Record<WorkoutSession["intensity"], number>
  );
  const availableDates = [...new Set(workoutHistory.map((w) => w.date))].sort((a, b) => b.localeCompare(a));

  function handlePrint() {
    const data: ReportData = {
      date: selectedDate,
      workouts: dayWorkouts,
      totalMinutes,
      recovery: recoveryState,
      fitnessProfile: {
        fitnessLevel: fitnessProfile.fitnessLevel,
        experienceMonths: fitnessProfile.experienceMonths,
        goals: fitnessProfile.goals,
        preferredActivities: fitnessProfile.preferredActivities,
        workoutsPerWeek: fitnessProfile.workoutsPerWeek,
        availableTimeMinutes: fitnessProfile.availableTimeMinutes,
        availableEquipment: fitnessProfile.availableEquipment,
        isProfileComplete: fitnessProfile.isProfileComplete,
      },
      isi: {
        score: currentScore.score,
        label: currentScore.label,
        trend: currentScore.trend,
        hrv: currentSample.hrv,
        heartRate: currentSample.heartRate,
        spo2: currentSample.spo2,
        signalQuality: currentSample.signalQuality.overall,
      },
    };
    printViaIframe(buildFitnessReport(data));
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-navy-200 shadow-lg">
      {/* Hero banner */}
      <div className="bg-gradient-to-r from-navy-900 via-navy-800 to-blue-900 px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 border border-white/20">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white tracking-tight">Fitness Report</h3>
            <p className="text-xs text-blue-200 mt-0.5">Includes wellness stats, recovery, profile & workouts</p>
          </div>
        </div>
        <Button onClick={handlePrint} size="default"
          className="gap-2 bg-white text-navy-900 hover:bg-blue-50 font-bold shadow-lg shrink-0 px-5 py-2.5 text-sm">
          <Printer className="h-4 w-4" /> Print Report
        </Button>
      </div>

      {/* Body */}
      <div className="bg-white px-6 py-5 space-y-5">
        {/* Date selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-navy-700 uppercase tracking-widest">Select Date</label>
          <div className="flex gap-2 flex-wrap items-center">
            <button onClick={() => setSelectedDate(todayISO)}
              className={cn("inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-bold transition-all",
                selectedDate === todayISO ? "bg-navy-900 text-white border-navy-900 shadow" : "bg-white text-navy-600 border-navy-200 hover:border-navy-500 hover:bg-navy-50")}>
              <Calendar className="h-3 w-3" /> Today
            </button>
            <div className="relative">
              <button onClick={() => setShowPicker((p) => !p)}
                className={cn("inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-bold transition-all",
                  selectedDate !== todayISO ? "bg-navy-900 text-white border-navy-900 shadow" : "bg-white text-navy-600 border-navy-200 hover:border-navy-500 hover:bg-navy-50")}>
                <Calendar className="h-3 w-3" />
                {selectedDate !== todayISO ? new Date(selectedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Pick a date"}
                <ChevronDown className="h-3 w-3" />
              </button>
              {showPicker && (
                <div className="absolute left-0 top-full mt-1 z-20 w-56 rounded-xl border border-navy-200 bg-white shadow-xl overflow-hidden">
                  <div className="p-3 border-b border-navy-100">
                    <input type="date" value={selectedDate} max={todayISO}
                      onChange={(e) => { setSelectedDate(e.target.value); setShowPicker(false); }}
                      className="w-full text-xs rounded-lg border border-navy-200 px-2 py-1.5 text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900" />
                  </div>
                  {availableDates.length > 0 && (
                    <div className="max-h-52 overflow-y-auto">
                      <p className="px-3 py-1.5 text-[10px] font-bold text-navy-400 uppercase tracking-wide">Recorded dates</p>
                      {availableDates.slice(0, 20).map((d) => (
                        <button key={d} onClick={() => { setSelectedDate(d); setShowPicker(false); }}
                          className={cn("w-full text-left px-3 py-2 text-xs hover:bg-navy-50 transition-colors flex items-center justify-between",
                            d === selectedDate ? "font-bold text-navy-900 bg-navy-50" : "text-navy-600")}>
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

        {/* Preview panel */}
        <div className="rounded-xl border border-navy-200 bg-navy-50/50 p-4 space-y-3">
          <p className="text-xs font-bold text-navy-700 uppercase tracking-wide">Report includes</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-navy-600">
            {[
              `ISI ${currentScore.score.toFixed(1)} — ${currentScore.label}`,
              `HR ${Math.round(currentSample.heartRate)} bpm · HRV ${Math.round(currentSample.hrv)} ms`,
              `SpO₂ ${currentSample.spo2.toFixed(1)}%`,
              `Avg sleep ${recoveryState.avgSleepHours}h · ${recoveryState.sleepConsistencyPercent}% consistency`,
              `${recoveryState.workoutCount} workouts this week · ${recoveryState.totalWorkoutMinutes} min`,
              `${dayWorkouts.length} session${dayWorkouts.length !== 1 ? "s" : ""} on selected date · ${totalMinutes} min`,
            ].map((item) => (
              <span key={item} className="flex items-center gap-1.5 bg-white border border-navy-100 rounded-lg px-2.5 py-1.5 leading-snug">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />{item}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <Button onClick={handlePrint} size="default" className="w-full gap-2 font-bold text-sm py-3">
          <Printer className="h-4 w-4" />
          {dayWorkouts.length === 0
            ? "Print Report (no workouts on this date)"
            : `Print Full Report — ${dayWorkouts.length} session${dayWorkouts.length !== 1 ? "s" : ""}, ${totalMinutes} min`}
        </Button>
      </div>
    </div>
  );
}

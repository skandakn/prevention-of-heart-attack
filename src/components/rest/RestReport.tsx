"use client";

import { useState } from "react";
import { useFitRest } from "@/lib/fit-rest/FitRestContext";
import { useSimulation } from "@/lib/simulation/SimulationContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SleepSession } from "@/lib/fit-rest/types";
import { cn } from "@/lib/utils";
import { Printer, Calendar, FileText, ChevronDown, Moon } from "lucide-react";

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

function qualityColor(q: SleepSession["quality"]) {
  if (q === "excellent") return "#16a34a";
  if (q === "good") return "#2563eb";
  if (q === "fair") return "#d97706";
  return "#dc2626";
}

function isiBarColor(score: number) {
  if (score < 30) return "#16a34a";
  if (score < 60) return "#f59e0b";
  return "#dc2626";
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
  .doc-header { border-bottom: 2px solid #4f46e5; padding-bottom: 14px; margin-bottom: 20px;
                display: flex; justify-content: space-between; align-items: flex-start; }
  .doc-header-right { text-align: right; font-size: 11px; color: #94a3b8; }
  .grid4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 6px; }
  .grid3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-bottom: 6px; }
  .grid2 { display: grid; grid-template-columns: repeat(2,1fr); gap: 10px; margin-bottom: 6px; }
  .stat  { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 13px; }
  .stat-label { font-size: 9.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; }
  .stat-value { font-size: 19px; font-weight: 800; color: #1e2a3a; margin-top: 2px; }
  .stat-unit  { font-size: 11px; color: #64748b; }
  .isi-bar  { height: 8px; border-radius: 99px; background: #e2e8f0; margin: 6px 0 2px; overflow: hidden; }
  .isi-fill { height: 100%; border-radius: 99px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11px;
           font-weight: 700; text-transform: capitalize; color: white; }
  .section-box { border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; margin-bottom: 4px; }
  .section-box-header { background: #f8fafc; padding: 8px 13px; font-size: 11px; font-weight: 700;
                        color: #475569; border-bottom: 1px solid #e2e8f0; }
  .section-box-body { padding: 12px 13px; }
  .info-row { display: flex; justify-content: space-between; padding: 5px 0;
              border-bottom: 1px solid #f1f5f9; font-size: 12.5px; }
  .info-row:last-child { border-bottom: none; }
  .info-key { color: #64748b; }
  .info-val { font-weight: 600; color: #1e2a3a; text-align: right; max-width: 60%; }
  .tag { display: inline-block; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px;
         padding: 2px 7px; font-size: 11px; color: #475569; margin: 2px 3px 2px 0; }
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
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 2000);
    }, 250);
  };
}

// ─── Label maps ───────────────────────────────────────────────────────────────

const SLEEP_GOAL_LABELS: Record<string, string> = {
  improve_quality: "Improve quality", increase_duration: "Increase duration",
  better_consistency: "Better consistency", faster_falling_asleep: "Fall asleep faster",
  reduce_night_waking: "Reduce night waking", improve_recovery: "Improve recovery",
};
const RECOVERY_GOAL_LABELS: Record<string, string> = {
  muscle_recovery: "Muscle recovery", reduce_fatigue: "Reduce fatigue",
  stress_management: "Stress management", injury_recovery: "Injury recovery",
  general_wellness: "General wellness",
};
const SLEEP_CHALLENGE_LABELS: Record<string, string> = {
  difficulty_falling_asleep: "Difficulty falling asleep", waking_during_night: "Waking during night",
  early_waking: "Early waking", poor_quality: "Poor quality", irregular_schedule: "Irregular schedule",
};
const RECOVERY_ACTIVITY_LABELS: Record<string, string> = {
  meditation: "Meditation", stretching: "Stretching", foam_rolling: "Foam rolling",
  massage: "Massage", reading: "Reading", warm_bath: "Warm bath",
  breathing_exercises: "Breathing exercises", gentle_yoga: "Gentle yoga",
};

// ─── HTML builder ─────────────────────────────────────────────────────────────

interface RestReportData {
  date: string;
  sessions: SleepSession[];
  recovery: {
    avgSleepHours: number; sleepConsistencyPercent: number; sleepDebtHours: number;
    workoutCount: number; totalWorkoutMinutes: number; intenseWorkoutCount: number;
    recentSleepSummary: string; recentWorkoutSummary: string;
  };
  restProfile: {
    targetSleepHours: number; typicalBedtime: string; typicalWakeTime: string;
    sleepGoals: string[]; recoveryGoals: string[]; sleepChallenges: string[];
    preferredRecoveryActivities: string[]; isProfileComplete: boolean;
  };
  isi: { score: number; label: string; trend: string; hrv: number; heartRate: number; spo2: number; signalQuality: number; };
}

function buildRestReport(d: RestReportData): string {
  const gen = new Date().toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const isiPct = Math.min(100, Math.round(d.isi.score));

  // ── Wellness section
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

  // ── 7-day sleep & recovery stats
  const statsHTML = `
    <h2>7-Day Sleep &amp; Recovery Summary</h2>
    <div class="grid3">
      <div class="stat"><p class="stat-label">Avg Sleep</p><p class="stat-value">${d.recovery.avgSleepHours.toFixed(1)}<span class="stat-unit">h</span></p></div>
      <div class="stat"><p class="stat-label">Consistency</p><p class="stat-value">${d.recovery.sleepConsistencyPercent}<span class="stat-unit">%</span></p></div>
      <div class="stat"><p class="stat-label">Sleep Debt</p><p class="stat-value">${d.recovery.sleepDebtHours.toFixed(1)}<span class="stat-unit">h</span></p></div>
    </div>
    <div class="grid3">
      <div class="stat"><p class="stat-label">Target Sleep</p><p class="stat-value">${d.restProfile.targetSleepHours}<span class="stat-unit">h</span></p></div>
      <div class="stat"><p class="stat-label">Workouts This Week</p><p class="stat-value">${d.recovery.workoutCount}</p></div>
      <div class="stat"><p class="stat-label">Active Minutes</p><p class="stat-value">${d.recovery.totalWorkoutMinutes}</p></div>
    </div>
    <div class="section-box" style="margin-top:8px">
      <div class="section-box-body">
        <div class="info-row"><span class="info-key">Sleep summary</span><span class="info-val">${d.recovery.recentSleepSummary}</span></div>
        <div class="info-row"><span class="info-key">Activity summary</span><span class="info-val">${d.recovery.recentWorkoutSummary}</span></div>
        <div class="info-row"><span class="info-key">Typical bedtime</span><span class="info-val">${d.restProfile.typicalBedtime}</span></div>
        <div class="info-row"><span class="info-key">Typical wake time</span><span class="info-val">${d.restProfile.typicalWakeTime}</span></div>
      </div>
    </div>`;

  // ── Rest profile
  const profileHTML = !d.restProfile.isProfileComplete
    ? `<p style="color:#94a3b8;font-style:italic">Rest profile not yet completed.</p>`
    : `<div class="section-box"><div class="section-box-body">
        <div class="info-row"><span class="info-key">Sleep goals</span><span class="info-val">${d.restProfile.sleepGoals.map(g => SLEEP_GOAL_LABELS[g] ?? g).join(", ") || "—"}</span></div>
        <div class="info-row"><span class="info-key">Recovery goals</span><span class="info-val">${d.restProfile.recoveryGoals.map(g => RECOVERY_GOAL_LABELS[g] ?? g).join(", ") || "—"}</span></div>
        <div class="info-row"><span class="info-key">Challenges</span><span class="info-val">${d.restProfile.sleepChallenges.map(c => SLEEP_CHALLENGE_LABELS[c] ?? c).join(", ") || "—"}</span></div>
        <div class="info-row"><span class="info-key">Recovery activities</span><span class="info-val">${d.restProfile.preferredRecoveryActivities.map(a => RECOVERY_ACTIVITY_LABELS[a] ?? a).join(", ") || "—"}</span></div>
      </div></div>`;

  // ── Sleep sessions for selected date
  const totalHours = d.sessions.reduce((s, e) => s + e.hoursSlept, 0);
  const avgHours = d.sessions.length > 0 ? (totalHours / d.sessions.length).toFixed(1) : "0";
  const sessionsHTML = d.sessions.length === 0
    ? `<div style="text-align:center;padding:28px 0;color:#94a3b8"><p style="font-weight:600">No sleep data recorded on this date.</p></div>`
    : `
      <div class="grid3" style="margin-bottom:12px">
        <div class="stat"><p class="stat-label">Sessions</p><p class="stat-value">${d.sessions.length}</p></div>
        <div class="stat"><p class="stat-label">Total Hours</p><p class="stat-value">${totalHours.toFixed(1)}<span class="stat-unit">h</span></p></div>
        <div class="stat"><p class="stat-label">Avg Hours</p><p class="stat-value">${avgHours}<span class="stat-unit">h</span></p></div>
      </div>
      <table>
        <thead><tr><th>#</th><th>Bedtime</th><th>Wake Time</th><th>Hours Slept</th><th>Quality</th><th>Notes</th></tr></thead>
        <tbody>${d.sessions.map((s, i) => `
          <tr>
            <td style="color:#94a3b8;font-weight:600">${i + 1}</td>
            <td>${fmtTime(s.bedtime)}</td>
            <td>${fmtTime(s.wakeTime)}</td>
            <td style="font-weight:600">${s.hoursSlept}h</td>
            <td><span class="badge" style="background:${qualityColor(s.quality)}">${s.quality}</span></td>
            <td style="color:#64748b;font-style:italic">${s.notes ?? "—"}</td>
          </tr>`).join("")}
        </tbody>
      </table>`;

  const body = `
    <div class="doc-header">
      <div><h1>BeatAhead Sleep &amp; Recovery Report</h1>
        <p style="color:#64748b;font-size:13px;margin-top:4px">${fmtDate(d.date)}</p></div>
      <div class="doc-header-right"><p>Generated</p><p style="color:#475569">${gen}</p></div>
    </div>
    ${wellnessHTML}
    ${statsHTML}
    <h2>Rest Profile</h2>${profileHTML}
    <h2>Sleep on ${fmtDate(d.date)}</h2>${sessionsHTML}
    <div class="disclaimer">⚠️ This report is for personal wellness tracking only. Wellness indicator data comes from a research prototype and is not clinically validated. Not a substitute for medical advice.</div>
    <div class="footer">BeatAhead ISI Platform · ${gen}</div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>BeatAhead Sleep Report</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RestReport() {
  const { sleepHistory, restProfile, recoveryState } = useFitRest();
  const { currentSample, currentScore } = useSimulation();

  const todayISO = toISO(new Date());
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [showPicker, setShowPicker] = useState(false);

  const daySessions = sleepHistory.filter((s) => s.date === selectedDate);
  const availableDates = [...new Set(sleepHistory.map((s) => s.date))].sort((a, b) => b.localeCompare(a));

  function handlePrint() {
    const data: RestReportData = {
      date: selectedDate,
      sessions: daySessions,
      recovery: recoveryState,
      restProfile: {
        targetSleepHours: restProfile.targetSleepHours,
        typicalBedtime: restProfile.typicalBedtime,
        typicalWakeTime: restProfile.typicalWakeTime,
        sleepGoals: restProfile.sleepGoals,
        recoveryGoals: restProfile.recoveryGoals,
        sleepChallenges: restProfile.sleepChallenges,
        preferredRecoveryActivities: restProfile.preferredRecoveryActivities,
        isProfileComplete: restProfile.isProfileComplete,
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
    printViaIframe(buildRestReport(data));
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-600" />
          <CardTitle className="text-base">Print Sleep Report</CardTitle>
        </div>
        <CardDescription>
          Full report with wellness stats, 7-day sleep metrics, rest profile and session details.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Date selector */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-semibold text-navy-700 uppercase tracking-wide">Report Date</label>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setSelectedDate(todayISO)}
                className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                  selectedDate === todayISO ? "bg-indigo-700 text-white border-indigo-700" : "bg-white text-navy-600 border-navy-200 hover:border-navy-400")}>
                <Calendar className="h-3 w-3" /> Today
              </button>
              <div className="relative">
                <button onClick={() => setShowPicker((p) => !p)}
                  className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                    selectedDate !== todayISO ? "bg-indigo-700 text-white border-indigo-700" : "bg-white text-navy-600 border-navy-200 hover:border-navy-400")}>
                  <Calendar className="h-3 w-3" />
                  {selectedDate !== todayISO
                    ? new Date(selectedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "Pick a date"}
                  <ChevronDown className="h-3 w-3" />
                </button>
                {showPicker && (
                  <div className="absolute left-0 top-full mt-1 z-20 w-52 rounded-xl border border-navy-200 bg-white shadow-lg overflow-hidden">
                    <div className="p-3 border-b border-navy-100">
                      <input type="date" value={selectedDate} max={todayISO}
                        onChange={(e) => { setSelectedDate(e.target.value); setShowPicker(false); }}
                        className="w-full text-xs rounded-lg border border-navy-200 px-2 py-1.5 text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    {availableDates.length > 0 && (
                      <div className="max-h-48 overflow-y-auto">
                        <p className="px-3 py-1.5 text-[10px] font-bold text-navy-400 uppercase tracking-wide">Recorded dates</p>
                        {availableDates.slice(0, 20).map((d) => (
                          <button key={d} onClick={() => { setSelectedDate(d); setShowPicker(false); }}
                            className={cn("w-full text-left px-3 py-2 text-xs hover:bg-navy-50 transition-colors",
                              d === selectedDate ? "font-bold text-navy-900 bg-navy-50" : "text-navy-600")}>
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
          <Button onClick={handlePrint} className="gap-2 shrink-0 bg-indigo-700 hover:bg-indigo-800" size="sm">
            <Printer className="h-4 w-4" /> Print Report
          </Button>
        </div>

        {/* Preview */}
        <div className="rounded-xl border border-navy-200 bg-navy-50/50 p-4 space-y-2">
          <p className="text-xs font-bold text-navy-700 uppercase tracking-wide">Report includes</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-navy-600">
            {[
              `ISI ${currentScore.score.toFixed(1)} — ${currentScore.label}`,
              `HR ${Math.round(currentSample.heartRate)} bpm · HRV ${Math.round(currentSample.hrv)} ms`,
              `SpO₂ ${currentSample.spo2.toFixed(1)}%`,
              `Avg sleep ${recoveryState.avgSleepHours}h · ${recoveryState.sleepConsistencyPercent}% consistency`,
              `Sleep debt ${recoveryState.sleepDebtHours.toFixed(1)}h · target ${restProfile.targetSleepHours}h`,
              `${daySessions.length} session${daySessions.length !== 1 ? "s" : ""} on selected date`,
            ].map((item) => (
              <span key={item} className="flex items-center gap-1.5 bg-white border border-navy-100 rounded-lg px-2.5 py-1.5 leading-snug">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />{item}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

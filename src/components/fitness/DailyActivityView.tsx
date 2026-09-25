"use client";

import { useState, useMemo } from "react";
import { useFitRest } from "@/lib/fit-rest/FitRestContext";
import { EXERCISE_TYPE_LABELS } from "@/lib/fit-rest/types";
import type { WorkoutSession } from "@/lib/fit-rest/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Dumbbell,
  Clock,
  Footprints,
  Activity,
  TrendingUp,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISO(d: Date) {
  return d.toISOString().split("T")[0];
}

function fmtLong(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function parseSteps(notes: string | undefined): number {
  if (!notes) return 0;
  const m = notes.match(/^([\d,]+)\s+steps/);
  return m ? parseInt(m[1].replace(/,/g, ""), 10) : 0;
}

function intensityColor(i: WorkoutSession["intensity"]) {
  if (i === "light") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (i === "moderate") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
}

// ─── Calendar month grid ──────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay(); // 0=Sun
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DailyActivityView() {
  const { workoutHistory } = useFitRest();

  const todayISO = toISO(new Date());
  const [selectedDate, setSelectedDate] = useState(todayISO);

  // Calendar navigation state
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());

  // ── Build lookup: date → workouts ─────────────────────────────────────────
  const byDate = useMemo(() => {
    const map = new Map<string, WorkoutSession[]>();
    for (const w of workoutHistory) {
      const arr = map.get(w.date) ?? [];
      arr.push(w);
      map.set(w.date, arr);
    }
    return map;
  }, [workoutHistory]);

  // ── Active dates set (for calendar dots) ──────────────────────────────────
  const activeDates = useMemo(() => new Set(byDate.keys()), [byDate]);

  // ── Selected day data ──────────────────────────────────────────────────────
  const dayWorkouts = byDate.get(selectedDate) ?? [];
  const realWorkouts = dayWorkouts.filter((w) => !w.id.startsWith("gfit_steps_"));
  const stepEntries  = dayWorkouts.filter((w) =>  w.id.startsWith("gfit_steps_"));
  const totalSteps   = stepEntries.reduce((s, w) => s + parseSteps(w.notes), 0);
  const totalMins    = realWorkouts.reduce((s, w) => s + w.durationMinutes, 0);

  // ── Calendar helpers ───────────────────────────────────────────────────────
  const daysInMonth  = getDaysInMonth(calYear, calMonth);
  const firstDay     = getFirstDayOfMonth(calYear, calMonth);
  const monthLabel   = new Date(calYear, calMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
    else setCalMonth((m) => m - 1);
  }
  function nextMonth() {
    const now = new Date();
    // Don't go past current month
    if (calYear === now.getFullYear() && calMonth === now.getMonth()) return;
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
    else setCalMonth((m) => m + 1);
  }

  function selectDay(day: number) {
    const iso = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setSelectedDate(iso);
  }

  const isCurrentMonth = () => {
    const now = new Date();
    return calYear === now.getFullYear() && calMonth === now.getMonth();
  };

  // ── Oldest workout date (for min date) ────────────────────────────────────
  const oldestDate = useMemo(() => {
    if (workoutHistory.length === 0) return "2020-01-01";
    return [...workoutHistory].sort((a, b) => a.date.localeCompare(b.date))[0].date;
  }, [workoutHistory]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-navy-600" />
          <h2 className="text-lg font-semibold text-navy-900">Activity History</h2>
        </div>
        <p className="text-xs text-navy-500">
          {workoutHistory.filter((w) => !w.id.startsWith("gfit_steps_")).length} sessions recorded
          {workoutHistory.length > 0 && ` · since ${new Date(oldestDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">

        {/* ── Calendar ────────────────────────────────────────────────── */}
        <Card className="self-start">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <button
                onClick={prevMonth}
                className="rounded-lg p-1.5 hover:bg-navy-100 transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4 text-navy-600" />
              </button>
              <CardTitle className="text-sm font-bold text-navy-900">{monthLabel}</CardTitle>
              <button
                onClick={nextMonth}
                disabled={isCurrentMonth()}
                className="rounded-lg p-1.5 hover:bg-navy-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4 text-navy-600" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-1">
              {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
                <div key={d} className="text-center text-[10px] font-bold text-navy-400 uppercase py-1">{d}</div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {/* Blank cells before month start */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const iso = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isToday = iso === todayISO;
                const isSelected = iso === selectedDate;
                const hasActivity = activeDates.has(iso);
                const isFuture = iso > todayISO;

                return (
                  <button
                    key={day}
                    onClick={() => !isFuture && selectDay(day)}
                    disabled={isFuture}
                    className={cn(
                      "relative flex flex-col items-center justify-center rounded-lg py-1.5 text-xs font-semibold transition-all",
                      isFuture && "opacity-25 cursor-not-allowed",
                      isSelected && "bg-navy-900 text-white",
                      !isSelected && isToday && "bg-navy-100 text-navy-900 font-bold",
                      !isSelected && !isToday && !isFuture && "hover:bg-navy-50 text-navy-700",
                    )}
                  >
                    {day}
                    {/* Activity dot */}
                    {hasActivity && (
                      <span className={cn(
                        "absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full",
                        isSelected ? "bg-white/70" : "bg-blue-500"
                      )} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-navy-100">
              <div className="flex items-center gap-1.5 text-[10px] text-navy-500">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 inline-block" />
                Has activity
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-navy-500">
                <span className="h-3.5 w-3.5 rounded bg-navy-100 inline-block" />
                Today
              </div>
            </div>

            {/* Quick-jump to oldest date */}
            {workoutHistory.length > 0 && (
              <button
                onClick={() => {
                  const d = new Date(oldestDate);
                  setCalYear(d.getFullYear());
                  setCalMonth(d.getMonth());
                  setSelectedDate(oldestDate);
                }}
                className="mt-2 w-full text-center text-[11px] text-blue-600 hover:text-blue-800 transition-colors"
              >
                Jump to first activity ↩
              </button>
            )}
          </CardContent>
        </Card>

        {/* ── Day detail ──────────────────────────────────────────────── */}
        <div className="space-y-3">
          {/* Date heading */}
          <div className="flex items-center gap-2">
            <div className={cn(
              "h-2 w-2 rounded-full shrink-0",
              dayWorkouts.length > 0 ? "bg-emerald-500" : "bg-navy-300"
            )} />
            <h3 className="text-sm font-bold text-navy-900">{fmtLong(selectedDate)}</h3>
            {selectedDate === todayISO && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">Today</span>
            )}
          </div>

          {/* Empty state */}
          {dayWorkouts.length === 0 && (
            <Card className="border-dashed border-navy-200">
              <CardContent className="py-10 text-center">
                <Dumbbell className="h-8 w-8 text-navy-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-navy-500">No activity recorded</p>
                <p className="text-xs text-navy-400 mt-1">
                  {workoutHistory.length === 0
                    ? "Connect Google Fit to import your activity history."
                    : "No workouts or steps logged on this day."}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Steps card */}
          {totalSteps > 0 && (
            <Card className="border-violet-200 bg-violet-50/40">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-violet-100 p-2.5">
                      <Footprints className="h-4 w-4 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Footsteps</p>
                      <p className="text-2xl font-bold text-navy-900 mt-0.5">{totalSteps.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="w-24 h-1.5 rounded-full bg-navy-200 overflow-hidden mb-1">
                      <div
                        className={cn("h-full rounded-full", totalSteps >= 10000 ? "bg-emerald-500" : "bg-violet-500")}
                        style={{ width: `${Math.min(100, (totalSteps / 10000) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-navy-400">{totalSteps >= 10000 ? "Goal reached!" : `${totalSteps.toLocaleString()} / 10,000`}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Day summary bar */}
          {(realWorkouts.length > 0) && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: Dumbbell, label: "Sessions", value: String(realWorkouts.length), color: "text-emerald-600 bg-emerald-100" },
                { icon: Clock,    label: "Total Time", value: `${totalMins} min`,       color: "text-blue-600 bg-blue-100" },
                { icon: TrendingUp, label: "Intense", value: String(realWorkouts.filter((w) => w.intensity === "intense").length), color: "text-red-600 bg-red-100" },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="rounded-xl border border-navy-100 bg-white p-3 text-center">
                  <div className={cn("rounded-full p-1.5 w-fit mx-auto mb-1", color)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-sm font-bold text-navy-900">{value}</p>
                  <p className="text-[10px] text-navy-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Workout cards */}
          {realWorkouts.map((w) => (
            <Card key={w.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="rounded-lg bg-navy-100 p-2.5 shrink-0">
                      <Activity className="h-4 w-4 text-navy-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-navy-900 truncate">
                        {EXERCISE_TYPE_LABELS[w.type] ?? w.type}
                      </p>
                      {w.notes && (
                        <p className="text-xs text-navy-500 italic mt-0.5 truncate">{w.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-navy-700">
                      <Clock className="h-3.5 w-3.5 text-navy-400" />
                      {w.durationMinutes} min
                    </span>
                    <span className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold capitalize",
                      intensityColor(w.intensity)
                    )}>
                      {w.intensity}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

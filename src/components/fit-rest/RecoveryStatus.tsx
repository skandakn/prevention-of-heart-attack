"use client";

import { useFitRest } from "@/lib/fit-rest/FitRestContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, Moon, Dumbbell, TrendingUp } from "lucide-react";

// ─── Component ───────────────────────────────────────────────────────────────

export function RecoveryStatus() {
  const { recoveryState } = useFitRest();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-navy-600" />
          <CardTitle className="text-base">Recovery Status</CardTitle>
        </div>
        <CardDescription>
          Your recent activity and rest patterns
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary cards grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Sleep average */}
          <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="rounded-full bg-blue-600 p-1.5">
                <Moon className="h-3 w-3 text-white" />
              </div>
              <p className="text-xs font-semibold text-blue-700">Sleep Avg</p>
            </div>
            <p className="text-xl font-bold text-blue-900">
              {recoveryState.avgSleepHours}h
            </p>
            <p className="text-xs text-blue-700 mt-0.5">per night</p>
          </div>

          {/* Workout count */}
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="rounded-full bg-emerald-600 p-1.5">
                <Dumbbell className="h-3 w-3 text-white" />
              </div>
              <p className="text-xs font-semibold text-emerald-700">Workouts</p>
            </div>
            <p className="text-xl font-bold text-emerald-900">
              {recoveryState.workoutCount}
            </p>
            <p className="text-xs text-emerald-700 mt-0.5">this week</p>
          </div>

          {/* Active minutes */}
          <div className="rounded-lg border border-purple-100 bg-purple-50/50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="rounded-full bg-purple-600 p-1.5">
                <Activity className="h-3 w-3 text-white" />
              </div>
              <p className="text-xs font-semibold text-purple-700">Active Min</p>
            </div>
            <p className="text-xl font-bold text-purple-900">
              {recoveryState.totalWorkoutMinutes}
            </p>
            <p className="text-xs text-purple-700 mt-0.5">this week</p>
          </div>

          {/* Sleep consistency */}
          <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="rounded-full bg-amber-600 p-1.5">
                <TrendingUp className="h-3 w-3 text-white" />
              </div>
              <p className="text-xs font-semibold text-amber-700">Consistency</p>
            </div>
            <p className="text-xl font-bold text-amber-900">
              {recoveryState.sleepConsistencyPercent}%
            </p>
            <p className="text-xs text-amber-700 mt-0.5">sleep pattern</p>
          </div>
        </div>

        {/* Recent workout summary */}
        {recoveryState.recentWorkoutSummary && (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-4 py-3">
            <div className="flex items-start gap-2">
              <Dumbbell className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-emerald-700 mb-1">
                  Activity Summary
                </p>
                <p className="text-sm text-emerald-700">
                  {recoveryState.recentWorkoutSummary}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Recent sleep summary */}
        {recoveryState.recentSleepSummary && (
          <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3">
            <div className="flex items-start gap-2">
              <Moon className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-blue-700 mb-1">
                  Sleep Summary
                </p>
                <p className="text-sm text-blue-700">
                  {recoveryState.recentSleepSummary}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Sleep debt context (if exists) */}
        {recoveryState.sleepDebtHours > 0 && (
          <div className="rounded-lg border border-navy-100 bg-navy-50/50 px-4 py-3">
            <div className="flex items-start gap-2">
              <Activity className="h-4 w-4 text-navy-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-navy-700 mb-1">
                  Recovery Context
                </p>
                <p className="text-xs text-navy-700 leading-relaxed">
                  You have {recoveryState.sleepDebtHours.toFixed(1)} hours of sleep below your weekly target. 
                  Balancing activity with adequate rest supports your wellness goals.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Balance indicator */}
        <div className="rounded-lg border border-navy-100 bg-white px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-navy-700 mb-1">
                Intense Sessions
              </p>
              <p className="text-sm text-navy-600">
                {recoveryState.intenseWorkoutCount} of {recoveryState.workoutCount} workouts were moderate or intense
              </p>
            </div>
            <div className="rounded-full bg-navy-100 p-2">
              <TrendingUp className="h-4 w-4 text-navy-600" />
            </div>
          </div>
        </div>

        {/* Wellness note */}
        <div className="rounded-lg border border-navy-100 bg-navy-50/50 px-3 py-2">
          <p className="text-[10px] text-navy-600 leading-relaxed text-center">
            Recovery status reflects recent activity and rest patterns. This is wellness context, not a medical assessment.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

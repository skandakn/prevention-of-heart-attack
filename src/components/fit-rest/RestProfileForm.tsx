"use client";

import { useFitRest } from "@/lib/fit-rest/FitRestContext";
import {
  SLEEP_GOAL_LABELS,
  RECOVERY_GOAL_LABELS,
  SLEEP_CHALLENGE_LABELS,
  RECOVERY_ACTIVITY_LABELS,
  TARGET_SLEEP_OPTIONS,
  BEDTIME_OPTIONS,
  WAKE_TIME_OPTIONS,
} from "@/lib/fit-rest/types";
import type {
  SleepGoal,
  RecoveryGoal,
  SleepChallenge,
  RecoveryActivity,
} from "@/lib/fit-rest/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Moon } from "lucide-react";

// ─── Component ───────────────────────────────────────────────────────────────

export function RestProfileForm() {
  const { restProfile, updateRestProfile } = useFitRest();

  function toggleSleepGoal(goal: SleepGoal) {
    const current = restProfile.sleepGoals;
    const next = current.includes(goal)
      ? current.filter((g) => g !== goal)
      : [...current, goal];
    updateRestProfile({ sleepGoals: next });
  }

  function toggleRecoveryGoal(goal: RecoveryGoal) {
    const current = restProfile.recoveryGoals;
    const next = current.includes(goal)
      ? current.filter((g) => g !== goal)
      : [...current, goal];
    updateRestProfile({ recoveryGoals: next });
  }

  function toggleSleepChallenge(challenge: SleepChallenge) {
    const current = restProfile.sleepChallenges;
    const next = current.includes(challenge)
      ? current.filter((c) => c !== challenge)
      : [...current, challenge];
    updateRestProfile({ sleepChallenges: next });
  }

  function toggleRecoveryActivity(activity: RecoveryActivity) {
    const current = restProfile.preferredRecoveryActivities;
    const next = current.includes(activity)
      ? current.filter((a) => a !== activity)
      : [...current, activity];
    updateRestProfile({ preferredRecoveryActivities: next });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Moon className="h-4 w-4 text-navy-600" />
          <CardTitle className="text-base">Rest & Sleep Profile</CardTitle>
        </div>
        <CardDescription>
          Your sleep and recovery preferences are stored locally in this browser and used to personalize wellness recommendations.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ── Target sleep hours ─────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-navy-700 uppercase tracking-wide">
            Target sleep duration
          </label>
          <div className="flex gap-2">
            {TARGET_SLEEP_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => updateRestProfile({ targetSleepHours: value })}
                className={cn(
                  "flex-1 rounded-lg border py-2 text-xs font-medium transition-colors",
                  restProfile.targetSleepHours === value
                    ? "border-navy-900 bg-navy-900 text-white"
                    : "border-navy-200 bg-white text-navy-700 hover:border-navy-400"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Typical bedtime ────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-navy-700 uppercase tracking-wide">
            Typical bedtime
          </label>
          <select
            value={restProfile.typicalBedtime}
            onChange={(e) =>
              updateRestProfile({ typicalBedtime: e.target.value })
            }
            className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900"
          >
            {BEDTIME_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* ── Typical wake time ──────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-navy-700 uppercase tracking-wide">
            Typical wake time
          </label>
          <select
            value={restProfile.typicalWakeTime}
            onChange={(e) =>
              updateRestProfile({ typicalWakeTime: e.target.value })
            }
            className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900"
          >
            {WAKE_TIME_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* ── Sleep goals — multi-select chips ───────────────────────── */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-navy-700 uppercase tracking-wide">
            Sleep goals{" "}
            <span className="text-[10px] font-normal text-navy-400 normal-case">
              (select all that apply)
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(SLEEP_GOAL_LABELS) as [SleepGoal, string][]).map(
              ([value, label]) => {
                const selected = restProfile.sleepGoals.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleSleepGoal(value)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      selected
                        ? "border-navy-900 bg-navy-900 text-white"
                        : "border-navy-200 bg-white text-navy-700 hover:border-navy-400 hover:bg-navy-50"
                    )}
                  >
                    {label}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* ── Recovery goals — multi-select chips ────────────────────── */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-navy-700 uppercase tracking-wide">
            Recovery goals{" "}
            <span className="text-[10px] font-normal text-navy-400 normal-case">
              (select all that apply)
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(RECOVERY_GOAL_LABELS) as [RecoveryGoal, string][]).map(
              ([value, label]) => {
                const selected = restProfile.recoveryGoals.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleRecoveryGoal(value)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      selected
                        ? "border-navy-900 bg-navy-900 text-white"
                        : "border-navy-200 bg-white text-navy-700 hover:border-navy-400 hover:bg-navy-50"
                    )}
                  >
                    {label}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* ── Sleep challenges — multi-select chips ──────────────────── */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-navy-700 uppercase tracking-wide">
            Sleep challenges{" "}
            <span className="text-[10px] font-normal text-navy-400 normal-case">
              (optional)
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(SLEEP_CHALLENGE_LABELS) as [SleepChallenge, string][]).map(
              ([value, label]) => {
                const selected = restProfile.sleepChallenges.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleSleepChallenge(value)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      selected
                        ? "border-navy-900 bg-navy-900 text-white"
                        : "border-navy-200 bg-white text-navy-700 hover:border-navy-400 hover:bg-navy-50"
                    )}
                  >
                    {label}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* ── Preferred recovery activities — multi-select chips ─────── */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-navy-700 uppercase tracking-wide">
            Preferred recovery activities{" "}
            <span className="text-[10px] font-normal text-navy-400 normal-case">
              (select all that apply)
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(RECOVERY_ACTIVITY_LABELS) as [RecoveryActivity, string][]).map(
              ([value, label]) => {
                const selected = restProfile.preferredRecoveryActivities.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleRecoveryActivity(value)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      selected
                        ? "border-navy-900 bg-navy-900 text-white"
                        : "border-navy-200 bg-white text-navy-700 hover:border-navy-400 hover:bg-navy-50"
                    )}
                  >
                    {label}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* ── Auto-save notice ───────────────────────────────────────── */}
        <p className="text-xs text-navy-500 text-center pt-2 border-t border-navy-100">
          Changes are saved automatically.
        </p>
      </CardContent>
    </Card>
  );
}

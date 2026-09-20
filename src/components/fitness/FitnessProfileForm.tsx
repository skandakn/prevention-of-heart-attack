"use client";

import { useFitRest } from "@/lib/fit-rest/FitRestContext";
import {
  FITNESS_LEVEL_LABELS,
  FITNESS_GOAL_LABELS,
  EXERCISE_TYPE_LABELS,
  EQUIPMENT_LABELS,
} from "@/lib/fit-rest/types";
import type {
  FitnessLevel,
  FitnessGoal,
  ExerciseType,
  Equipment,
} from "@/lib/fit-rest/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Dumbbell } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const WORKOUTS_PER_WEEK = [1, 2, 3, 4, 5, 6, 7] as const;
const WORKOUT_TIMES = [15, 30, 45, 60, 90] as const;

// ─── Component ───────────────────────────────────────────────────────────────

export function FitnessProfileForm() {
  const { fitnessProfile, updateFitnessProfile } = useFitRest();

  function toggleGoal(goal: FitnessGoal) {
    const current = fitnessProfile.goals;
    const next = current.includes(goal)
      ? current.filter((g) => g !== goal)
      : [...current, goal];
    updateFitnessProfile({ goals: next.length > 0 ? next : ["general_fitness"] });
  }

  function toggleActivity(activity: ExerciseType) {
    const current = fitnessProfile.preferredActivities;
    const next = current.includes(activity)
      ? current.filter((a) => a !== activity)
      : [...current, activity];
    updateFitnessProfile({ preferredActivities: next });
  }

  function toggleEquipment(equipment: Equipment) {
    const current = fitnessProfile.availableEquipment;
    const next = current.includes(equipment)
      ? current.filter((e) => e !== equipment)
      : [...current, equipment];
    updateFitnessProfile({ availableEquipment: next });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Dumbbell className="h-4 w-4 text-navy-600" />
          <CardTitle className="text-base">Fitness Profile</CardTitle>
        </div>
        <CardDescription>
          Your fitness preferences are stored locally in this browser and used to personalize workout
          recommendations.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ── Fitness level ──────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-navy-700 uppercase tracking-wide">
            Fitness level
          </label>
          <select
            value={fitnessProfile.fitnessLevel}
            onChange={(e) =>
              updateFitnessProfile({ fitnessLevel: e.target.value as FitnessLevel })
            }
            className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900"
          >
            {(Object.entries(FITNESS_LEVEL_LABELS) as [FitnessLevel, string][]).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              )
            )}
          </select>
        </div>

        {/* ── Fitness goals — multi-select chips ─────────────────────── */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-navy-700 uppercase tracking-wide">
            Fitness goals{" "}
            <span className="text-[10px] font-normal text-navy-400 normal-case">
              (select all that apply)
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(FITNESS_GOAL_LABELS) as [FitnessGoal, string][]).map(
              ([value, label]) => {
                const selected = fitnessProfile.goals.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleGoal(value)}
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

        {/* ── Preferred activities — multi-select chips ──────────────── */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-navy-700 uppercase tracking-wide">
            Preferred activities{" "}
            <span className="text-[10px] font-normal text-navy-400 normal-case">
              (select all that apply)
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(EXERCISE_TYPE_LABELS) as [ExerciseType, string][]).map(
              ([value, label]) => {
                const selected = fitnessProfile.preferredActivities.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleActivity(value)}
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

        {/* ── Workouts per week ──────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-navy-700 uppercase tracking-wide">
            Workouts per week
          </label>
          <div className="flex gap-2">
            {WORKOUTS_PER_WEEK.map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => updateFitnessProfile({ workoutsPerWeek: num })}
                className={cn(
                  "flex-1 rounded-lg border py-2 text-xs font-medium transition-colors",
                  fitnessProfile.workoutsPerWeek === num
                    ? "border-navy-900 bg-navy-900 text-white"
                    : "border-navy-200 bg-white text-navy-700 hover:border-navy-400"
                )}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* ── Available workout time ─────────────────────────────────── */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-navy-700 uppercase tracking-wide">
            Available workout time (minutes)
          </label>
          <div className="flex gap-2">
            {WORKOUT_TIMES.map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => updateFitnessProfile({ availableTimeMinutes: mins })}
                className={cn(
                  "flex-1 rounded-lg border py-2 text-xs font-medium transition-colors",
                  fitnessProfile.availableTimeMinutes === mins
                    ? "border-navy-900 bg-navy-900 text-white"
                    : "border-navy-200 bg-white text-navy-700 hover:border-navy-400"
                )}
              >
                {mins}
              </button>
            ))}
          </div>
        </div>

        {/* ── Available equipment — multi-select chips ───────────────── */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-navy-700 uppercase tracking-wide">
            Available equipment{" "}
            <span className="text-[10px] font-normal text-navy-400 normal-case">
              (select all that apply)
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(EQUIPMENT_LABELS) as [Equipment, string][]).map(
              ([value, label]) => {
                const selected = fitnessProfile.availableEquipment.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleEquipment(value)}
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

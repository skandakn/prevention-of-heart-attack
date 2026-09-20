"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EXERCISE_TYPE_LABELS } from "@/lib/fit-rest/types";
import type { WorkoutSession, ExerciseType, WorkoutIntensity } from "@/lib/fit-rest/types";
import { Clock, Dumbbell, TrendingUp, Zap, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Extended Exercise Detail (for detailed workout plans) ────────────────────

export interface ExerciseDetail {
  name: string;
  type: ExerciseType;
  sets?: number;
  reps?: number;
  durationMinutes?: number;
  restSeconds?: number;
  notes?: string;
}

export interface DetailedWorkoutPlan extends Omit<WorkoutSession, "id" | "date"> {
  exercises?: ExerciseDetail[];
  warmupMinutes?: number;
  cooldownMinutes?: number;
  estimatedTotalMinutes?: number;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface WorkoutPlanCardProps {
  workout: WorkoutSession | DetailedWorkoutPlan;
  showDate?: boolean;
  className?: string;
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function getIntensityColor(intensity: WorkoutIntensity): string {
  switch (intensity) {
    case "light":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "moderate":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "intense":
      return "bg-red-100 text-red-700 border-red-200";
  }
}

function getIntensityIcon(intensity: WorkoutIntensity) {
  switch (intensity) {
    case "light":
      return <TrendingUp className="h-3 w-3" />;
    case "moderate":
      return <Zap className="h-3 w-3" />;
    case "intense":
      return <Zap className="h-3 w-3" />;
  }
}

function isDetailedPlan(
  workout: WorkoutSession | DetailedWorkoutPlan
): workout is DetailedWorkoutPlan {
  return "exercises" in workout && Array.isArray(workout.exercises);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateStr = date.toISOString().split("T")[0];
  const todayStr = today.toISOString().split("T")[0];
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  if (dateStr === todayStr) return "Today";
  if (dateStr === yesterdayStr) return "Yesterday";

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WorkoutPlanCard({
  workout,
  showDate = true,
  className,
}: WorkoutPlanCardProps) {
  const isDetailed = isDetailedPlan(workout);
  const isDemoData = "isDemoData" in workout ? workout.isDemoData : false;

  const totalDuration = isDetailed
    ? workout.estimatedTotalMinutes || workout.durationMinutes
    : workout.durationMinutes;

  return (
    <Card className={cn("relative", className)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Dumbbell className="h-4 w-4 text-navy-600" />
              <CardTitle className="text-base">
                {EXERCISE_TYPE_LABELS[workout.type]}
              </CardTitle>
            </div>
            <CardDescription className="flex flex-wrap items-center gap-2">
              {"date" in workout && showDate && (
                <span className="text-xs text-navy-500">
                  {formatDate(workout.date)}
                </span>
              )}
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  getIntensityColor(workout.intensity)
                )}
              >
                {getIntensityIcon(workout.intensity)}
                {workout.intensity}
              </span>
            </CardDescription>
          </div>

          {/* Total duration badge */}
          <div className="flex items-center gap-1.5 rounded-lg bg-navy-50 px-3 py-1.5 text-sm font-semibold text-navy-700">
            <Clock className="h-3.5 w-3.5" />
            {totalDuration} min
          </div>
        </div>

        {/* Demo indicator */}
        {isDemoData && (
          <div className="flex items-center gap-1.5 mt-2 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">
              Demo Mode — Simulated Data
            </p>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Detailed workout plan with exercises */}
        {isDetailed && workout.exercises && workout.exercises.length > 0 && (
          <div className="space-y-3">
            {/* Warm-up */}
            {workout.warmupMinutes && workout.warmupMinutes > 0 && (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2">
                <p className="text-xs font-semibold text-emerald-700 mb-0.5">
                  Warm-up
                </p>
                <p className="text-xs text-emerald-600">
                  {workout.warmupMinutes} minutes
                </p>
              </div>
            )}

            {/* Exercise list */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-navy-700 uppercase tracking-wide">
                Exercises
              </p>
              {workout.exercises.map((exercise, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-navy-100 bg-white px-3 py-2.5 space-y-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-navy-900">
                      {exercise.name}
                    </p>
                    <span className="text-[10px] font-medium text-navy-500 uppercase tracking-wide shrink-0">
                      {EXERCISE_TYPE_LABELS[exercise.type].split(" ")[0]}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-navy-600">
                    {exercise.sets && exercise.reps && (
                      <span>
                        <span className="font-semibold">{exercise.sets}</span> sets ×{" "}
                        <span className="font-semibold">{exercise.reps}</span> reps
                      </span>
                    )}
                    {exercise.durationMinutes && (
                      <span>
                        <span className="font-semibold">{exercise.durationMinutes}</span> min
                      </span>
                    )}
                    {exercise.restSeconds && (
                      <span className="text-navy-500">
                        Rest: <span className="font-medium">{exercise.restSeconds}s</span>
                      </span>
                    )}
                  </div>

                  {exercise.notes && (
                    <p className="text-xs text-navy-500 italic mt-1">
                      {exercise.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Cool-down */}
            {workout.cooldownMinutes && workout.cooldownMinutes > 0 && (
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2">
                <p className="text-xs font-semibold text-blue-700 mb-0.5">
                  Cool-down
                </p>
                <p className="text-xs text-blue-600">
                  {workout.cooldownMinutes} minutes stretching
                </p>
              </div>
            )}
          </div>
        )}

        {/* Simple workout session (no exercise details) */}
        {!isDetailed && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-navy-600">Duration</span>
              <span className="font-semibold text-navy-900">
                {workout.durationMinutes} minutes
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-navy-600">Intensity</span>
              <span className="font-semibold text-navy-900 capitalize">
                {workout.intensity}
              </span>
            </div>
            {workout.notes && (
              <div className="rounded-lg border border-navy-100 bg-navy-50/50 px-3 py-2 mt-3">
                <p className="text-xs font-semibold text-navy-700 mb-1">Notes</p>
                <p className="text-xs text-navy-600">{workout.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Summary for detailed plans */}
        {isDetailed && workout.exercises && (
          <div className="pt-3 border-t border-navy-100">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg bg-navy-50 px-3 py-2">
                <p className="text-[10px] font-medium text-navy-500 uppercase tracking-wide">
                  Exercises
                </p>
                <p className="text-base font-bold text-navy-900 mt-0.5">
                  {workout.exercises.length}
                </p>
              </div>
              <div className="rounded-lg bg-navy-50 px-3 py-2">
                <p className="text-[10px] font-medium text-navy-500 uppercase tracking-wide">
                  Total time
                </p>
                <p className="text-base font-bold text-navy-900 mt-0.5">
                  {totalDuration} min
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

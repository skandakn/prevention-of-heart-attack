"use client";

import { FitRestProvider, useFitRest } from "@/lib/fit-rest/FitRestContext";
import { WorkoutPlanCard } from "@/components/fit-rest/WorkoutPlanCard";
import { FitnessAIChat } from "@/components/fitness/FitnessAIChat";
import { FitnessProfileForm } from "@/components/fitness/FitnessProfileForm";
import { GoogleFitSync } from "@/components/fitness/GoogleFitSync";
import { FitnessReport } from "@/components/fitness/FitnessReport";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SimulatedBadge } from "@/components/layout/Toast";
import { Dumbbell, CheckCircle2, Calendar, TrendingUp, Clock, Target, Activity, History, Award } from "lucide-react";
import { EXERCISE_TYPE_LABELS } from "@/lib/fit-rest/types";
import { cn } from "@/lib/utils";

// ─── Inner page component (inside FitRestProvider) ────────────────────────────

function FitnessPageInner() {
  const { workoutHistory, fitnessProfile, recoveryState } = useFitRest();

  // Get today's or most recent workout
  const todaysWorkout = workoutHistory.length > 0 ? workoutHistory[0] : null;

  // Get recent workouts (last 5 for recent activity)
  const recentWorkouts = workoutHistory.slice(0, 5);

  // Calculate weekly progress percentage
  const weeklyProgressPercent = Math.min(
    Math.round((recoveryState.workoutCount / fitnessProfile.workoutsPerWeek) * 100),
    100
  );

  // Consistency description
  const getConsistencyDescription = () => {
    const percent = (recoveryState.workoutCount / fitnessProfile.workoutsPerWeek) * 100;
    if (percent >= 100) return "Excellent consistency! You've met your weekly goal.";
    if (percent >= 75) return "Great work! You're on track to meet your weekly goal.";
    if (percent >= 50) return "Good progress. Keep it up to reach your weekly goal.";
    if (percent >= 25) return "You've started the week well. Stay consistent!";
    return "Let's get moving! Schedule your first workout this week.";
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ── Page header ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-navy-900">Fitness</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              <Dumbbell className="h-3 w-3" />
              Wellness Agent
            </span>
          </div>
          <p className="text-sm text-navy-500">
            Personalized fitness guidance based on your wellness patterns.
          </p>
        </div>
        <SimulatedBadge className="self-start sm:self-auto shrink-0" />
      </div>

      {/* ── Fitness Overview Section ──────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-navy-600" />
          <h2 className="text-lg font-semibold text-navy-900">Fitness Overview</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Workouts this week */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-navy-500 uppercase tracking-wide">
                    This Week
                  </p>
                  <p className="text-2xl font-bold text-navy-900 mt-1">
                    {recoveryState.workoutCount}
                  </p>
                  <p className="text-xs text-navy-600 mt-0.5">
                    {recoveryState.workoutCount === 1 ? "workout" : "workouts"}
                  </p>
                </div>
                <div className="rounded-full bg-emerald-100 p-3">
                  <Dumbbell className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active minutes this week */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-navy-500 uppercase tracking-wide">
                    Active Minutes
                  </p>
                  <p className="text-2xl font-bold text-navy-900 mt-1">
                    {recoveryState.totalWorkoutMinutes}
                  </p>
                  <p className="text-xs text-navy-600 mt-0.5">
                    this week
                  </p>
                </div>
                <div className="rounded-full bg-blue-100 p-3">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Workout consistency */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-navy-500 uppercase tracking-wide">
                    Weekly Goal
                  </p>
                  <p className="text-2xl font-bold text-navy-900 mt-1">
                    {recoveryState.workoutCount}/{fitnessProfile.workoutsPerWeek}
                  </p>
                  <p className="text-xs text-navy-600 mt-0.5">
                    {weeklyProgressPercent}% complete
                  </p>
                </div>
                <div className="rounded-full bg-amber-100 p-3">
                  <Target className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Intense workouts */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-navy-500 uppercase tracking-wide">
                    Intense Sessions
                  </p>
                  <p className="text-2xl font-bold text-navy-900 mt-1">
                    {recoveryState.intenseWorkoutCount}
                  </p>
                  <p className="text-xs text-navy-600 mt-0.5">
                    this week
                  </p>
                </div>
                <div className="rounded-full bg-red-100 p-3">
                  <TrendingUp className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recovery summary */}
        {recoveryState.recentWorkoutSummary && (
          <Card className="bg-navy-50/50 border-navy-200">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <Activity className="h-4 w-4 text-navy-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-navy-700 mb-1">
                    7-Day Activity Summary
                  </p>
                  <p className="text-sm text-navy-600">
                    {recoveryState.recentWorkoutSummary}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Progress Section ───────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-navy-600" />
          <h2 className="text-lg font-semibold text-navy-900">Progress</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Weekly Goal Progress</CardTitle>
            <CardDescription>
              Track your workout consistency and progress toward your weekly fitness goals.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Visual progress bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-navy-700">
                  {recoveryState.workoutCount} of {fitnessProfile.workoutsPerWeek} workouts completed
                </span>
                <span className="font-bold text-navy-900">
                  {weeklyProgressPercent}%
                </span>
              </div>
              <div className="h-3 rounded-full bg-navy-100 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    weeklyProgressPercent >= 100 ? "bg-emerald-500" :
                    weeklyProgressPercent >= 75 ? "bg-blue-500" :
                    weeklyProgressPercent >= 50 ? "bg-amber-500" :
                    "bg-navy-400"
                  )}
                  style={{ width: `${weeklyProgressPercent}%` }}
                />
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-navy-100 bg-navy-50/50 p-3">
                <p className="text-xs font-medium text-navy-500 uppercase tracking-wide mb-1">
                  Total Minutes
                </p>
                <p className="text-xl font-bold text-navy-900">
                  {recoveryState.totalWorkoutMinutes}
                </p>
                <p className="text-xs text-navy-600 mt-0.5">
                  this week
                </p>
              </div>
              <div className="rounded-lg border border-navy-100 bg-navy-50/50 p-3">
                <p className="text-xs font-medium text-navy-500 uppercase tracking-wide mb-1">
                  Intense Sessions
                </p>
                <p className="text-xl font-bold text-navy-900">
                  {recoveryState.intenseWorkoutCount}
                </p>
                <p className="text-xs text-navy-600 mt-0.5">
                  of {recoveryState.workoutCount} workouts
                </p>
              </div>
            </div>

            {/* Consistency message */}
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
              <div className="flex items-start gap-2">
                <Award className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 leading-relaxed">
                  {getConsistencyDescription()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Today's Workout Section ───────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-navy-600" />
          <h2 className="text-lg font-semibold text-navy-900">Today&apos;s Workout</h2>
        </div>

        {todaysWorkout ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <WorkoutPlanCard workout={todaysWorkout} showDate={true} />
            </div>

            {/* ── Completion panel ──────────────────────────────────────── */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Workout Status</CardTitle>
                  <CardDescription>
                    Track your workout completion for today.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg border border-navy-100 bg-navy-50/50 p-4 text-center">
                    <p className="text-sm font-medium text-navy-700 mb-1">
                      Ready to start
                    </p>
                    <p className="text-xs text-navy-500">
                      Complete this workout to track your progress
                    </p>
                  </div>

                  <Button
                    className="w-full"
                    variant="default"
                    disabled
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Mark as Complete
                  </Button>

                  <p className="text-[10px] text-navy-400 text-center leading-relaxed">
                    Workout completion tracking coming soon. Focus on form and consistency.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Dumbbell className="h-12 w-12 text-navy-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-navy-700 mb-1">
                No workouts recorded yet
              </p>
              <p className="text-xs text-navy-500">
                Connect Google Fit below to import your real workouts, or complete your fitness profile to get started.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Workout History Section ────────────────────────────────────── */}
      {workoutHistory.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-navy-600" />
              <h2 className="text-lg font-semibold text-navy-900">Workout History</h2>
            </div>
            <p className="text-xs text-navy-500">
              {workoutHistory.length} {workoutHistory.length === 1 ? "workout" : "workouts"} recorded
            </p>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-navy-50 border-b border-navy-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-navy-700 uppercase tracking-wide">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-navy-700 uppercase tracking-wide">
                        Workout Type
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-navy-700 uppercase tracking-wide">
                        Duration
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-navy-700 uppercase tracking-wide">
                        Intensity
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-navy-700 uppercase tracking-wide">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-100">
                    {workoutHistory.map((workout, index) => (
                      <tr key={workout.id} className={cn(
                        "hover:bg-navy-50/50 transition-colors",
                        index % 2 === 0 ? "bg-white" : "bg-navy-50/30"
                      )}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-navy-900">
                              {new Date(workout.date).toLocaleDateString("en-US", { 
                                month: "short", 
                                day: "numeric"
                              })}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-navy-700">
                            {EXERCISE_TYPE_LABELS[workout.type]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-navy-900">
                            <Clock className="h-3 w-3 text-navy-500" />
                            {workout.durationMinutes} min
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold capitalize",
                            workout.intensity === "light" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                            workout.intensity === "moderate" && "bg-amber-50 text-amber-700 border-amber-200",
                            workout.intensity === "intense" && "bg-red-50 text-red-700 border-red-200"
                          )}>
                            {workout.intensity}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-navy-600 italic">
                            {workout.notes || "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Recent Activity Section (kept for backward compatibility) ──── */}
      {recentWorkouts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-navy-600" />
              <h2 className="text-lg font-semibold text-navy-900">Recent Activity</h2>
            </div>
            <p className="text-xs text-navy-500">
              Last {recentWorkouts.length} {recentWorkouts.length === 1 ? "workout" : "workouts"}
            </p>
          </div>

          <div className="space-y-3">
            {recentWorkouts.map((workout) => (
              <Card key={workout.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="rounded-lg bg-navy-100 p-2 shrink-0">
                        <Dumbbell className="h-4 w-4 text-navy-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-navy-900 truncate">
                            {EXERCISE_TYPE_LABELS[workout.type]}
                          </p>
                        </div>
                        <p className="text-xs text-navy-500">
                          {new Date(workout.date).toLocaleDateString("en-US", { 
                            month: "short", 
                            day: "numeric",
                            year: "numeric"
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-medium text-navy-500">Duration</p>
                        <p className="text-sm font-semibold text-navy-900">
                          {workout.durationMinutes} min
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-navy-500">Intensity</p>
                        <p className="text-sm font-semibold text-navy-900 capitalize">
                          {workout.intensity}
                        </p>
                      </div>
                    </div>
                  </div>
                  {workout.notes && (
                    <p className="text-xs text-navy-600 mt-2 pl-11 italic">
                      {workout.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── My Fitness Profile Section ─────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-5 w-5 text-navy-600" />
          <h2 className="text-lg font-semibold text-navy-900">
            My Fitness Profile
          </h2>
        </div>
        <div className="max-w-2xl">
          <FitnessProfileForm />
        </div>
      </div>

      {/* ── Google Fit Integration ─────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-navy-600" />
          <h2 className="text-lg font-semibold text-navy-900">Connect Google Fit</h2>
        </div>
        <div className="max-w-2xl">
          <GoogleFitSync />
        </div>
      </div>

      {/* ── Print Fitness Report Section ──────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-navy-600" />
          <h2 className="text-lg font-semibold text-navy-900">Print Report</h2>
        </div>
        <div className="max-w-2xl">
          <FitnessReport />
        </div>
      </div>

      {/* ── AI Fitness Coach Section ───────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-navy-900">AI Fitness Coach</h2>
        </div>

        <div className="max-w-4xl">
          <FitnessAIChat />
        </div>
      </div>

      {/* ── Wellness disclaimer ────────────────────────────────────────── */}
      <div className="rounded-xl border border-navy-100 bg-navy-50/50 px-4 py-3">
        <p className="text-[10px] text-navy-500 leading-relaxed text-center">
          This is a wellness fitness assistant, not medical advice. Consult a healthcare
          provider before starting any new exercise program, especially if you have
          pre-existing health conditions or injuries.
        </p>
      </div>
    </div>
  );
}

// ─── Page export (wraps inner in FitRestProvider) ─────────────────────────────

export default function FitnessPage() {
  return (
    <FitRestProvider>
      <FitnessPageInner />
    </FitRestProvider>
  );
}

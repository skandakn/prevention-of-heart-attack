"use client";

import { useFitRest } from "@/lib/fit-rest/FitRestContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Moon, Clock, TrendingUp, Target, AlertCircle, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Helper Functions ─────────────────────────────────────────────────────────

function formatTime(timeStr: string): string {
  const [hour, minute] = timeStr.split(':').map(Number);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}

function getAverageBedtime(sleepHistory: any[], fallback: string): string {
  if (sleepHistory.length === 0) return fallback;
  
  const recentSessions = sleepHistory.slice(0, 7);
  const bedtimes = recentSessions.map(s => {
    const bedtime = new Date(s.bedtime);
    return bedtime.getHours() + bedtime.getMinutes() / 60;
  });
  
  const avgHour = bedtimes.reduce((sum, h) => sum + h, 0) / bedtimes.length;
  const hour = Math.floor(avgHour);
  const minute = Math.round((avgHour - hour) * 60);
  
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function getAverageWakeTime(sleepHistory: any[], fallback: string): string {
  if (sleepHistory.length === 0) return fallback;
  
  const recentSessions = sleepHistory.slice(0, 7);
  const wakeTimes = recentSessions.map(s => {
    const wakeTime = new Date(s.wakeTime);
    return wakeTime.getHours() + wakeTime.getMinutes() / 60;
  });
  
  const avgHour = wakeTimes.reduce((sum, h) => sum + h, 0) / wakeTimes.length;
  const hour = Math.floor(avgHour);
  const minute = Math.round((avgHour - hour) * 60);
  
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SleepOverview() {
  const { sleepHistory, restProfile, recoveryState } = useFitRest();

  const avgBedtime = getAverageBedtime(sleepHistory, restProfile.typicalBedtime);
  const avgWakeTime = getAverageWakeTime(sleepHistory, restProfile.typicalWakeTime);

  return (
    <div className="space-y-4">
      {/* Sleep Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Average sleep duration */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-navy-500 uppercase tracking-wide">
                  Avg Sleep
                </p>
                <p className="text-2xl font-bold text-navy-900 mt-1">
                  {recoveryState.avgSleepHours}h
                </p>
                <p className="text-xs text-navy-600 mt-0.5">
                  per night
                </p>
              </div>
              <div className="rounded-full bg-blue-100 p-3">
                <Moon className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sleep consistency */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-navy-500 uppercase tracking-wide">
                  Consistency
                </p>
                <p className="text-2xl font-bold text-navy-900 mt-1">
                  {recoveryState.sleepConsistencyPercent}%
                </p>
                <p className="text-xs text-navy-600 mt-0.5">
                  based on recent sleep
                </p>
              </div>
              <div className="rounded-full bg-emerald-100 p-3">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Typical bedtime */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-navy-500 uppercase tracking-wide">
                  Bedtime
                </p>
                <p className="text-2xl font-bold text-navy-900 mt-1">
                  {formatTime(avgBedtime).split(' ')[0]}
                </p>
                <p className="text-xs text-navy-600 mt-0.5">
                  {formatTime(avgBedtime).split(' ')[1]}
                </p>
              </div>
              <div className="rounded-full bg-purple-100 p-3">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sleep goal */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-navy-500 uppercase tracking-wide">
                  Sleep Goal
                </p>
                <p className="text-2xl font-bold text-navy-900 mt-1">
                  {restProfile.targetSleepHours}h
                </p>
                <p className="text-xs text-navy-600 mt-0.5">
                  per night
                </p>
              </div>
              <div className="rounded-full bg-emerald-100 p-3">
                <Target className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sleep Trend Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weekly Sleep Trend</CardTitle>
          <CardDescription>
            Your sleep patterns over the last 7 days
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sleep summary */}
          {recoveryState.recentSleepSummary && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3">
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-blue-700 mb-1">
                    7-Day Sleep Summary
                  </p>
                  <p className="text-sm text-blue-700">
                    {recoveryState.recentSleepSummary}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Visual sleep bars */}
          {sleepHistory.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-navy-700 uppercase tracking-wide">
                Recent Sleep Duration
              </p>
              <div className="space-y-2">
                {sleepHistory.slice(0, 7).map((sleep) => {
                  const targetHours = restProfile.targetSleepHours;
                  const percentage = Math.min((sleep.hoursSlept / targetHours) * 100, 150);
                  
                  return (
                    <div key={sleep.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-navy-600 font-medium">
                          {new Date(sleep.date).toLocaleDateString('en-US', { 
                            weekday: 'short',
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </span>
                        <span className="text-navy-900 font-semibold">
                          {sleep.hoursSlept}h
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-navy-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all bg-blue-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sleep debt notice (wellness context only) */}
          {recoveryState.sleepDebtHours > 0 && (
            <div className="rounded-lg border border-amber-100 bg-amber-50/50 px-4 py-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-amber-700 mb-1">
                    Sleep Pattern Notice
                  </p>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    You have {recoveryState.sleepDebtHours.toFixed(1)} hours less sleep than your target this week. 
                    Consistent rest supports your wellness and recovery goals.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {sleepHistory.length === 0 && (
            <div className="rounded-lg border border-dashed border-navy-200 bg-white px-6 py-8 text-center">
              <Moon className="h-8 w-8 text-navy-300 mx-auto mb-2" />
              <p className="text-sm text-navy-500 font-medium">No sleep data recorded</p>
              <p className="text-xs text-navy-400 mt-1">
                Sleep tracking data will appear here once available.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wake time info */}
      <Card className="bg-navy-50/50 border-navy-200">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-navy-900 p-2">
                <Clock className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-navy-700">
                  Average Wake Time
                </p>
                <p className="text-sm font-bold text-navy-900">
                  {formatTime(avgWakeTime)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-navy-500">
                Based on {Math.min(sleepHistory.length, 7)} recent nights
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useFitRest } from "@/lib/fit-rest/FitRestContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Moon, Clock, Sparkles, Book, Wind, CheckCircle2 } from "lucide-react";

// ─── Helper Functions ─────────────────────────────────────────────────────────

function formatTime(timeStr: string): string {
  const [hour, minute] = timeStr.split(':').map(Number);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}

function calculateWindDownTime(bedtime: string): string {
  const [hour, minute] = bedtime.split(':').map(Number);
  const totalMinutes = hour * 60 + minute - 30; // 30 minutes before bed
  
  let windDownHour = Math.floor(totalMinutes / 60);
  let windDownMinute = totalMinutes % 60;
  
  if (windDownMinute < 0) {
    windDownMinute += 60;
    windDownHour -= 1;
  }
  if (windDownHour < 0) {
    windDownHour += 24;
  }
  
  return `${windDownHour.toString().padStart(2, '0')}:${windDownMinute.toString().padStart(2, '0')}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WindDownRoutine() {
  const { restProfile } = useFitRest();

  const windDownStartTime = calculateWindDownTime(restProfile.typicalBedtime);
  const hasRecoveryActivities = restProfile.preferredRecoveryActivities.length > 0;

  // Get personalized activity suggestions
  const getActivitySuggestion = () => {
    if (!hasRecoveryActivities) {
      return "a quiet, relaxing activity";
    }
    
    const activities = restProfile.preferredRecoveryActivities;
    if (activities.includes("meditation")) return "meditation";
    if (activities.includes("reading")) return "reading";
    if (activities.includes("stretching")) return "gentle stretching";
    if (activities.includes("breathing_exercises")) return "breathing exercises";
    if (activities.includes("gentle_yoga")) return "gentle yoga";
    
    return "a quiet, relaxing activity";
  };

  const activitySuggestion = getActivitySuggestion();

  // Build routine steps
  const routineSteps = [
    {
      icon: Sparkles,
      title: "Reduce Stimulation",
      time: "30 min before bed",
      description: "Dim lights and reduce screen time. Lower the brightness on devices or switch to reading mode.",
    },
    {
      icon: Wind,
      title: "Wind Down Activity",
      time: "20-25 min before bed",
      description: hasRecoveryActivities 
        ? `Engage in ${activitySuggestion} to help your mind and body prepare for rest.`
        : "Engage in a quiet, relaxing activity to help your mind and body prepare for rest.",
    },
    {
      icon: Book,
      title: "Prepare for Tomorrow",
      time: "15 min before bed",
      description: "Set out items for the morning and review tomorrow's schedule to reduce mental clutter.",
    },
    {
      icon: Moon,
      title: "Bedtime Routine",
      time: "5-10 min before bed",
      description: "Complete your personal bedtime routine (hygiene, comfortable clothing, room temperature).",
    },
    {
      icon: CheckCircle2,
      title: "Consistent Bedtime",
      time: formatTime(restProfile.typicalBedtime),
      description: `Aim to be in bed by ${formatTime(restProfile.typicalBedtime)} to support ${restProfile.targetSleepHours} hours of sleep.`,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Moon className="h-4 w-4 text-navy-600" />
          <CardTitle className="text-base">Wind-Down Routine</CardTitle>
        </div>
        <CardDescription>
          A simple routine to help you prepare for restful sleep
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Wind-down start time banner */}
        <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-600 p-2">
              <Clock className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                Wind-down starts
              </p>
              <p className="text-lg font-bold text-blue-900">
                {formatTime(windDownStartTime)}
              </p>
              <p className="text-xs text-blue-700 mt-0.5">
                About 30 minutes before your typical bedtime
              </p>
            </div>
          </div>
        </div>

        {/* Routine steps */}
        <div className="space-y-4">
          {routineSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="flex gap-3">
                <div className="flex flex-col items-center shrink-0">
                  <div className="rounded-full bg-navy-100 p-2">
                    <Icon className="h-4 w-4 text-navy-600" />
                  </div>
                  {index < routineSteps.length - 1 && (
                    <div className="w-0.5 h-full min-h-[20px] bg-navy-100 mt-2" />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-navy-900">
                      {step.title}
                    </p>
                    <span className="text-xs font-medium text-navy-500">
                      • {step.time}
                    </span>
                  </div>
                  <p className="text-xs text-navy-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Personalization note */}
        {restProfile.sleepGoals.length > 0 && (
          <div className="rounded-lg border border-navy-100 bg-navy-50/50 p-3">
            <p className="text-xs text-navy-600 leading-relaxed">
              <span className="font-semibold text-navy-700">Your sleep goals:</span>
              {" "}
              {restProfile.sleepGoals.includes("improve_quality") && "Improve sleep quality. "}
              {restProfile.sleepGoals.includes("faster_falling_asleep") && "Fall asleep faster. "}
              {restProfile.sleepGoals.includes("better_consistency") && "Better sleep consistency. "}
              {restProfile.sleepGoals.includes("improve_recovery") && "Improve recovery. "}
              A consistent wind-down routine supports these wellness goals.
            </p>
          </div>
        )}

        {/* Wellness disclaimer */}
        <div className="rounded-lg border border-navy-100 bg-white px-3 py-2">
          <p className="text-[10px] text-navy-500 leading-relaxed text-center">
            This is a wellness routine suggestion, not medical advice. Consult a healthcare
            provider for persistent sleep difficulties or concerns.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

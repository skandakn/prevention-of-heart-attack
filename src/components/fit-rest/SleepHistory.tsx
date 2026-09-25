"use client";

import { useFitRest } from "@/lib/fit-rest/FitRestContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Moon, Clock, Sun, History } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Helper Functions ─────────────────────────────────────────────────────────

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SleepHistory() {
  const { sleepHistory } = useFitRest();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-navy-600" />
          <CardTitle className="text-base">Sleep History</CardTitle>
        </div>
        <CardDescription>
          Your recorded sleep sessions and patterns
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Empty state */}
        {sleepHistory.length === 0 && (
          <div className="rounded-lg border border-dashed border-navy-200 bg-white px-6 py-12 text-center">
            <Moon className="h-10 w-10 text-navy-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-navy-700 mb-1">
              No sleep data recorded
            </p>
            <p className="text-xs text-navy-500">
              Sleep tracking data will appear here once available.
            </p>
          </div>
        )}

        {/* Sleep history list */}
        {sleepHistory.length > 0 && (
          <div className="space-y-3">
            {sleepHistory.map((sleep) => (
              <div
                key={sleep.id}
                className="rounded-lg border border-navy-100 bg-white p-4 transition-colors hover:bg-navy-50/50"
              >
                {/* Date */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-navy-900">
                    {formatDate(sleep.date)}
                  </p>
                </div>

                {/* Sleep details grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Hours slept */}
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-blue-100 p-2">
                      <Moon className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-navy-500">Hours Slept</p>
                      <p className="text-sm font-bold text-navy-900">{sleep.hoursSlept}h</p>
                    </div>
                  </div>

                  {/* Sleep quality */}
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "rounded-full p-2",
                      sleep.quality === "excellent" && "bg-emerald-100",
                      sleep.quality === "good" && "bg-blue-100",
                      sleep.quality === "fair" && "bg-amber-100",
                      sleep.quality === "poor" && "bg-red-100"
                    )}>
                      <Sun className={cn(
                        "h-3.5 w-3.5",
                        sleep.quality === "excellent" && "text-emerald-600",
                        sleep.quality === "good" && "text-blue-600",
                        sleep.quality === "fair" && "text-amber-600",
                        sleep.quality === "poor" && "text-red-600"
                      )} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-navy-500">Quality</p>
                      <p className="text-sm font-bold text-navy-900 capitalize">{sleep.quality}</p>
                    </div>
                  </div>

                  {/* Bedtime */}
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-purple-100 p-2">
                      <Moon className="h-3.5 w-3.5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-navy-500">Bedtime</p>
                      <p className="text-sm font-bold text-navy-900">{formatTime(sleep.bedtime)}</p>
                    </div>
                  </div>

                  {/* Wake time */}
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-amber-100 p-2">
                      <Clock className="h-3.5 w-3.5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-navy-500">Wake Time</p>
                      <p className="text-sm font-bold text-navy-900">{formatTime(sleep.wakeTime)}</p>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {sleep.notes && (
                  <div className="mt-3 pt-3 border-t border-navy-100">
                    <p className="text-xs text-navy-600 italic">
                      {sleep.notes}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Record count */}
        {sleepHistory.length > 0 && (
          <div className="mt-4 pt-3 border-t border-navy-100 text-center">
            <p className="text-xs text-navy-500">
              {sleepHistory.length} {sleepHistory.length === 1 ? 'record' : 'records'} total
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

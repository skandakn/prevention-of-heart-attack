/**
 * Google Fit → BeatAhead mapper utilities (server-side only).
 *
 * Converts raw Google Fit activity session data into the WorkoutSession
 * format used by FitRestContext / the fitness agent.
 *
 * Reference: https://developers.google.com/fit/rest/v1/reference/users/sessions
 */

import type { WorkoutSession, ExerciseType, WorkoutIntensity } from "@/lib/fit-rest/types";

// ─── Google Fit activity-type IDs → BeatAhead ExerciseType ───────────────────
// Full list: https://developers.google.com/fit/rest/v1/reference/activity-types

const ACTIVITY_TYPE_MAP: Record<number, ExerciseType> = {
  1:   "biking",          // Aerobics — closest to cardio; fallback
  9:   "running",         // Aerobics — no exact match, use running
  8:   "cycling",         // Biking (ergometer / road)
  17:  "cycling",         // Biking, mountain
  16:  "cycling",         // Biking, hand
  56:  "running",         // Jogging
  97:  "running",         // Running (treadmill)
  79:  "running",         // Running (road)
  108: "walking",         // Walking (treadmill)
  109: "walking",         // Walking (fitness)
  107: "walking",         // Walking
  82:  "swimming",        // Swimming (open water)
  83:  "swimming",        // Swimming (pool)
  10:  "bodyweight",      // Calisthenics (bodyweight)
  30:  "hiit",            // Elliptical
  32:  "weightlifting",   // Strength training
  4:   "bodyweight",      // Archery — fallback
  63:  "bodyweight",      // P90X — closest
  20:  "yoga",            // Yoga
  44:  "pilates",         // Pilates
  46:  "sports",          // Racquetball
  57:  "sports",          // Jumping rope
  87:  "hiit",            // Interval training
  15:  "sports",          // Badminton
  113: "sports",          // Soccer
  45:  "sports",          // Rock climbing
} as unknown as Record<number, ExerciseType>;

// Fix TypeScript: "biking" isn't in ExerciseType, remap to closest valid
const FALLBACK_ACTIVITY_MAP: Record<string, ExerciseType> = {
  biking: "cycling",
};

function resolveExerciseType(fitActivityType: number): ExerciseType {
  const raw = ACTIVITY_TYPE_MAP[fitActivityType];
  if (!raw) return "bodyweight"; // safe default
  return (FALLBACK_ACTIVITY_MAP[raw as string] ?? raw) as ExerciseType;
}

// ─── Duration (ms) → intensity ───────────────────────────────────────────────

function durationToIntensity(durationMs: number, activityType: number): WorkoutIntensity {
  const minutes = durationMs / 1000 / 60;

  // High-intensity activity types
  const intenseTypes = new Set([87, 30, 97, 79, 56, 32]);

  if (intenseTypes.has(activityType) || minutes < 20) return "intense";
  if (minutes < 45) return "moderate";
  return "light";
}

// ─── Google Fit session interface (minimal fields we use) ─────────────────────

interface GoogleFitSession {
  id: string;
  name?: string;
  activityType: number;
  startTimeMillis: string;
  endTimeMillis: string;
}

// ─── Main mapper ──────────────────────────────────────────────────────────────

export function mapGoogleFitSessions(sessions: GoogleFitSession[]): WorkoutSession[] {
  return sessions
    .filter((s) => {
      const start = Number(s.startTimeMillis);
      const end = Number(s.endTimeMillis);
      // Must have valid timestamps and at least 1 minute duration
      return !isNaN(start) && !isNaN(end) && end - start >= 1 * 60 * 1000;
    })
    .map((s) => {
      const startMs = Number(s.startTimeMillis);
      const endMs = Number(s.endTimeMillis);
      const durationMs = endMs - startMs;
      const durationMinutes = Math.round(durationMs / 1000 / 60);
      const type = resolveExerciseType(s.activityType);
      const intensity = durationToIntensity(durationMs, s.activityType);
      const dateStr = new Date(startMs).toISOString().split("T")[0]; // YYYY-MM-DD

      return {
        id: `gfit_${s.id}`,
        date: dateStr,
        type,
        durationMinutes,
        intensity,
        notes: s.name ? `Imported from Google Fit: ${s.name}` : "Imported from Google Fit",
        isDemoData: false,
      } satisfies WorkoutSession;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ─── Step count fetching & mapping ───────────────────────────────────────────

/**
 * Fetch daily step-count buckets from the Google Fit Fitness API dataset endpoint,
 * then convert each day that has meaningful steps into a WorkoutSession of type "walking".
 *
 * Steps live in a data-source dataset, not in sessions, so they are invisible to
 * the /sessions endpoint used for tracked workouts.
 *
 * Reference:
 *   https://developers.google.com/fit/rest/v1/reference/users/dataset/aggregate
 */

interface AggregateBucket {
  startTimeMillis: string;
  endTimeMillis: string;
  dataset?: {
    dataSourceId: string;
    point?: {
      value?: { intVal?: number }[];
    }[];
  }[];
}

interface AggregateResponse {
  bucket?: AggregateBucket[];
}

// Minimum steps to count as a meaningful walking session (roughly 10 minutes walking)
const MIN_STEPS_THRESHOLD = 1000;

// Average walking speed: ~100 steps/minute
function stepsToDurationMinutes(steps: number): number {
  return Math.max(5, Math.round(steps / 100));
}

function stepsToIntensity(steps: number): WorkoutIntensity {
  if (steps < 3000) return "light";
  if (steps < 8000) return "moderate";
  return "intense";
}

export async function fetchAndMapSteps(
  accessToken: string,
  startMs: number,
  endMs: number
): Promise<WorkoutSession[]> {
  const body = {
    aggregateBy: [
      {
        dataTypeName: "com.google.step_count.delta",
        dataSourceId: "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps",
      },
    ],
    bucketByTime: { durationMillis: "86400000" }, // 1-day buckets
    startTimeMillis: String(startMs),
    endTimeMillis: String(endMs),
  };

  const res = await fetch(
    "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    console.error(`[GFit Steps] Aggregate fetch failed: ${res.status}`);
    return [];
  }

  const data = (await res.json()) as AggregateResponse;
  const buckets = data.bucket ?? [];
  const sessions: WorkoutSession[] = [];

  for (const bucket of buckets) {
    const startMs = Number(bucket.startTimeMillis);
    const dateStr = new Date(startMs).toISOString().split("T")[0];

    let totalSteps = 0;
    for (const ds of bucket.dataset ?? []) {
      for (const point of ds.point ?? []) {
        for (const val of point.value ?? []) {
          totalSteps += val.intVal ?? 0;
        }
      }
    }

    if (totalSteps < MIN_STEPS_THRESHOLD) continue;

    sessions.push({
      id: `gfit_steps_${dateStr}`,
      date: dateStr,
      type: "walking" as ExerciseType,
      durationMinutes: stepsToDurationMinutes(totalSteps),
      intensity: stepsToIntensity(totalSteps),
      notes: `${totalSteps.toLocaleString()} steps · Imported from Google Fit`,
      isDemoData: false,
    } satisfies WorkoutSession);
  }

  return sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

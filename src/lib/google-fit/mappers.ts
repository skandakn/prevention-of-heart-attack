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
// Source: https://developers.google.com/fit/rest/v1/reference/activity-types

const ACTIVITY_TYPE_MAP: Record<number, ExerciseType> = {
  // ── Cycling ──────────────────────────────────────────────────────────────
  1:   "cycling",   // Biking
  14:  "cycling",   // Handbiking
  15:  "cycling",   // Mountain biking
  16:  "cycling",   // Road biking
  17:  "cycling",   // Spinning
  18:  "cycling",   // Stationary biking
  19:  "cycling",   // Utility biking

  // ── Running ──────────────────────────────────────────────────────────────
  8:   "running",   // Running
  56:  "running",   // Jogging
  57:  "running",   // Running on sand
  58:  "running",   // Running (treadmill)
  88:  "running",   // Treadmill (walking or running)

  // ── Walking ──────────────────────────────────────────────────────────────
  7:   "walking",   // Walking
  93:  "walking",   // Walking (fitness)
  94:  "walking",   // Nordic walking
  95:  "walking",   // Walking (treadmill)
  116: "walking",   // Walking (stroller)

  // ── Swimming ─────────────────────────────────────────────────────────────
  82:  "swimming",  // Swimming
  83:  "swimming",  // Swimming (pool)
  84:  "swimming",  // Swimming (open water)

  // ── Yoga / Pilates ────────────────────────────────────────────────────────
  100: "yoga",      // Yoga
  49:  "pilates",   // Pilates

  // ── Weightlifting / Strength ──────────────────────────────────────────────
  80:  "weightlifting",  // Strength training
  97:  "weightlifting",  // Weightlifting
  41:  "weightlifting",  // Kettlebell training

  // ── HIIT / Intense cardio ─────────────────────────────────────────────────
  114: "hiit",      // HIIT
  115: "hiit",      // Interval training
  25:  "hiit",      // Elliptical
  22:  "hiit",      // Circuit training
  9:   "hiit",      // Aerobics

  // ── Bodyweight / Calisthenics ──────────────────────────────────────────────
  21:  "bodyweight",  // Calisthenics
  47:  "bodyweight",  // P90X exercises
  33:  "bodyweight",  // Gymnastics

  // ── Sports (general) ──────────────────────────────────────────────────────
  20:  "sports",    // Boxing
  42:  "sports",    // Kickboxing
  44:  "sports",    // Martial arts
  46:  "sports",    // Mixed martial arts
  113: "sports",    // Crossfit
  10:  "sports",    // Badminton
  11:  "sports",    // Baseball
  12:  "sports",    // Basketball
  23:  "sports",    // Cricket
  26:  "sports",    // Fencing
  27:  "sports",    // Football (American)
  28:  "sports",    // Football (Australian)
  29:  "sports",    // Football (Soccer)
  30:  "sports",    // Frisbee
  34:  "sports",    // Handball
  36:  "sports",    // Hockey
  39:  "sports",    // Jumping rope
  51:  "sports",    // Racquetball
  52:  "sports",    // Rock climbing
  55:  "sports",    // Rugby
  59:  "sports",    // Sailing
  61:  "sports",    // Skateboarding
  76:  "sports",    // Squash
  85:  "sports",    // Table tennis
  86:  "sports",    // Team sports
  87:  "sports",    // Tennis
  89:  "sports",    // Volleyball
  90:  "sports",    // Volleyball (beach)
  91:  "sports",    // Volleyball (indoor)
  96:  "sports",    // Waterpolo
  120: "sports",    // Softball

  // ── Hiking / Outdoor ───────────────────────────────────────────────────────
  35:  "walking",   // Hiking (closest to walking)
  79:  "sports",    // Stand-up paddleboarding
  40:  "sports",    // Kayaking
  81:  "sports",    // Surfing

  // ── Stair climbing ─────────────────────────────────────────────────────────
  77:  "hiit",      // Stair climbing
  78:  "hiit",      // Stair-climbing machine

  // ── Rowing ────────────────────────────────────────────────────────────────
  53:  "sports",    // Rowing
  54:  "sports",    // Rowing machine

  // ── Fallback for unclassified ──────────────────────────────────────────────
  108: "bodyweight",  // Other (unclassified fitness activity)
  4:   "bodyweight",  // Unknown
};

// Intensity overrides — these are always "intense" regardless of duration
const ALWAYS_INTENSE = new Set([
  20,  // Boxing
  42,  // Kickboxing
  44,  // Martial arts
  46,  // MMA
  113, // Crossfit
  114, // HIIT
  115, // Interval training
  22,  // Circuit training
  77,  // Stair climbing
  78,  // Stair-climbing machine
  80,  // Strength training
  97,  // Weightlifting
]);

const ALWAYS_MODERATE = new Set([
  8, 56, 57, 58, // Running
  82, 83, 84,    // Swimming
  1, 15, 16, 17, // Cycling
  35,            // Hiking
]);

function resolveExerciseType(fitActivityType: number): ExerciseType {
  return ACTIVITY_TYPE_MAP[fitActivityType] ?? "bodyweight";
}

// ─── Duration (ms) → intensity ───────────────────────────────────────────────

function durationToIntensity(durationMs: number, activityType: number): WorkoutIntensity {
  if (ALWAYS_INTENSE.has(activityType)) return "intense";
  if (ALWAYS_MODERATE.has(activityType)) return "moderate";
  const minutes = durationMs / 1000 / 60;
  if (minutes < 20) return "intense";
  if (minutes < 60) return "moderate";
  return "light";
}

// Max plausible session duration — anything over 3 hours is likely a tracker error
const MAX_SESSION_MINUTES = 180;

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
      // Must have valid timestamps — no minimum duration filter (Google Fit tracks even <1 min sessions)
      return !isNaN(start) && !isNaN(end) && end > start;
    })
    .map((s) => {
      const startMs = Number(s.startTimeMillis);
      const endMs = Number(s.endTimeMillis);
      const durationMs = endMs - startMs;
      const durationMinutes = Math.min(
        Math.round(durationMs / 1000 / 60),
        MAX_SESSION_MINUTES
      );
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
  // Step 1: discover what step data sources exist on this account
  let stepSourceId: string | null = null;
  let stepDataType = "com.google.step_count.delta";

  try {
    const dsRes = await fetch(
      "https://www.googleapis.com/fitness/v1/users/me/dataSources",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (dsRes.ok) {
      const dsData = await dsRes.json() as {
        dataSource?: { dataStreamId: string; dataType?: { name: string } }[]
      };
      const sources = dsData.dataSource ?? [];

      // Prefer raw delta source, fall back to cumulative (OPPO / some Android phones)
      const deltaSource = sources.find(s =>
        s.dataType?.name === "com.google.step_count.delta" && s.dataStreamId.startsWith("raw:")
      );
      const cumulativeSource = sources.find(s =>
        s.dataType?.name === "com.google.step_count.cumulative"
      );

      if (deltaSource) {
        stepSourceId = deltaSource.dataStreamId;
        stepDataType = "com.google.step_count.delta";
      } else if (cumulativeSource) {
        stepSourceId = cumulativeSource.dataStreamId;
        stepDataType = "com.google.step_count.cumulative";
      }
    }
  } catch {
    // ignore — fall through to generic aggregate
  }

  const sessions: WorkoutSession[] = [];

  // Step 2a: if cumulative source (OPPO-style pedometer), read raw dataset directly
  // Fetch in 90-day chunks to avoid API limits on nanosecond dataset IDs
  if (stepSourceId && stepDataType === "com.google.step_count.cumulative") {
    try {
      const encodedSource = encodeURIComponent(stepSourceId);
      const CHUNK_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
      const byDay = new Map<string, number>();

      // Walk backwards from endMs in 90-day chunks
      let chunkEnd = endMs;
      while (chunkEnd > startMs) {
        const chunkStart = Math.max(startMs, chunkEnd - CHUNK_MS);
        // Dataset IDs use nanoseconds
        const datasetId = `${chunkStart}000000-${chunkEnd}000000`;

        const rawRes = await fetch(
          `https://www.googleapis.com/fitness/v1/users/me/dataSources/${encodedSource}/datasets/${datasetId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (rawRes.ok) {
          const rawData = await rawRes.json() as {
            point?: {
              startTimeNanos: string;
              endTimeNanos: string;
              value?: { intVal?: number }[]
            }[]
          };

          // OPPO cumulative pedometer resets at midnight each day.
          // Take the MAX value seen in each day — that's the day's total steps.
          for (const point of rawData.point ?? []) {
            const dayMs = Number(BigInt(point.startTimeNanos) / BigInt(1_000_000));
            const dateStr = new Date(dayMs).toISOString().split("T")[0];
            const val = point.value?.[0]?.intVal ?? 0;
            // Take the maximum reading of the day (last reading = total for day)
            const existing = byDay.get(dateStr) ?? 0;
            if (val > existing) byDay.set(dateStr, val);
          }
        } else {
          console.error(`[GFit Steps] Raw dataset chunk failed: ${rawRes.status}`);
        }

        chunkEnd = chunkStart - 1;
      }

      for (const [dateStr, steps] of byDay.entries()) {
        if (steps < MIN_STEPS_THRESHOLD) continue;
        sessions.push({
          id: `gfit_steps_${dateStr}`,
          date: dateStr,
          type: "walking" as ExerciseType,
          durationMinutes: stepsToDurationMinutes(steps),
          intensity: stepsToIntensity(steps),
          notes: `${steps.toLocaleString()} steps · Imported from Google Fit`,
          isDemoData: false,
        } satisfies WorkoutSession);
      }
    } catch (e) {
      console.error("[GFit Steps] Raw cumulative fetch failed:", e);
    }

    return sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  // Step 2b: use aggregate API for delta sources (or generic fallback)
  const aggregateBy = stepSourceId
    ? [{ dataTypeName: stepDataType, dataSourceId: stepSourceId }]
    : [{ dataTypeName: "com.google.step_count.delta" }];

  let aggRes = await fetch(
    "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        aggregateBy,
        bucketByTime: { durationMillis: "86400000" },
        startTimeMillis: String(startMs),
        endTimeMillis: String(endMs),
      }),
    }
  );

  // If specific source failed, retry without specifying a source
  if (!aggRes.ok && stepSourceId) {
    aggRes = await fetch(
      "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          aggregateBy: [{ dataTypeName: "com.google.step_count.delta" }],
          bucketByTime: { durationMillis: "86400000" },
          startTimeMillis: String(startMs),
          endTimeMillis: String(endMs),
        }),
      }
    );
  }

  if (!aggRes.ok) {
    console.error(`[GFit Steps] Aggregate fetch failed: ${aggRes.status}`);
    return sessions;
  }

  const data = (await aggRes.json()) as AggregateResponse;
  for (const bucket of data.bucket ?? []) {
    const bucketStartMs = Number(bucket.startTimeMillis);
    const dateStr = new Date(bucketStartMs).toISOString().split("T")[0];
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

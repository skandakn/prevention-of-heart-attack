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

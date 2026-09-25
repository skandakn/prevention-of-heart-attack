/**
 * Google Fit → BeatAhead mapper utilities (server-side only).
 *
 * Converts raw Google Fit activity session data into the WorkoutSession
 * format used by FitRestContext / the fitness agent.
 *
 * Reference: https://developers.google.com/fit/rest/v1/reference/users/sessions
 */

import type {
  WorkoutSession,
  ExerciseType,
  WorkoutIntensity,
  SleepSession,
  SleepQuality,
  GoogleFitNutrientBreakdown,
  GoogleFitMealLog,
  GoogleFitNutritionData,
} from "@/lib/fit-rest/types";

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

  // Step 2a: if cumulative source (OPPO-style), read raw dataset directly
  if (stepSourceId && stepDataType === "com.google.step_count.cumulative") {
    try {
      const encodedSource = encodeURIComponent(stepSourceId);
      // Dataset ID uses nanoseconds
      const datasetId = `${startMs}000000-${endMs}000000`;
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

        // Group by day, compute daily increment from cumulative counter
        const byDay = new Map<string, number>();
        const points = (rawData.point ?? []).sort(
          (a, b) => Number(BigInt(a.startTimeNanos) - BigInt(b.startTimeNanos))
        );

        let prevVal = 0;
        for (const point of points) {
          const dayMs = Number(BigInt(point.startTimeNanos) / BigInt(1_000_000));
          const dateStr = new Date(dayMs).toISOString().split("T")[0];
          const val = point.value?.[0]?.intVal ?? 0;
          const increment = val > prevVal ? val - prevVal : val; // handle resets
          prevVal = val;
          byDay.set(dateStr, (byDay.get(dateStr) ?? 0) + increment);
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

// ─── Sleep session fetching & mapping ────────────────────────────────────────

/**
 * Google Fit activity type 72 = "Sleep".
 * The sessions API returns sleep sessions with startTimeMillis / endTimeMillis.
 * We compute duration, derive a quality score from duration, and map to SleepSession.
 *
 * Reference:
 *   https://developers.google.com/fit/rest/v1/reference/activity-types (type 72)
 */

function durationToSleepQuality(durationHours: number): SleepQuality {
  if (durationHours >= 7.5) return "excellent";
  if (durationHours >= 6.5) return "good";
  if (durationHours >= 5)   return "fair";
  return "poor";
}

export async function fetchAndMapSleep(
  accessToken: string,
  startMs: number,
  endMs: number
): Promise<SleepSession[]> {
  const SLEEP_ACTIVITY_TYPE = 72;
  const sessions: SleepSession[] = [];
  const datesWithSleep = new Set<string>();

  // 1. Fetch tracked sessions (apps that log Sessions with activityType 72 or name containing sleep/bedtime)
  try {
    const res = await fetch(
      `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${new Date(startMs).toISOString()}&endTime=${new Date(endMs).toISOString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (res.ok) {
      const data = (await res.json()) as { session?: GoogleFitSession[] };
      const raw = (data.session ?? []).filter(
        (s) => s.activityType === SLEEP_ACTIVITY_TYPE || s.name?.toLowerCase().includes("sleep") || s.name?.toLowerCase().includes("bedtime")
      );

      for (const s of raw) {
        const startTimeMs = Number(s.startTimeMillis);
        const endTimeMs = Number(s.endTimeMillis);
        if (isNaN(startTimeMs) || isNaN(endTimeMs) || endTimeMs - startTimeMs < 30 * 60 * 1000) continue;

        const durationMs = endTimeMs - startTimeMs;
        const hoursSlept = Math.round((durationMs / 1000 / 3600) * 10) / 10;
        const dateStr = new Date(startTimeMs).toISOString().split("T")[0];

        datesWithSleep.add(dateStr);
        sessions.push({
          id: `gfit_sleep_${s.id}`,
          date: dateStr,
          bedtime: new Date(startTimeMs).toISOString(),
          wakeTime: new Date(endTimeMs).toISOString(),
          hoursSlept,
          quality: durationToSleepQuality(hoursSlept),
          notes: `Imported from Google Fit${s.name ? `: ${s.name}` : ""}`,
          isDemoData: false,
        });
      }
    }
  } catch (err) {
    console.error("[GFit Sleep] Sessions fetch error:", err);
  }

  // 2. Discover sleep data sources (com.google.sleep.segment) & read raw datasets
  try {
    let sleepSources: string[] = [
      "derived:com.google.sleep.segment:com.google.android.gms:merged",
      "derived:com.google.activity.segment:com.google.android.gms:merge_activity_segments",
    ];
    try {
      const dsRes = await fetch("https://www.googleapis.com/fitness/v1/users/me/dataSources", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (dsRes.ok) {
        const dsData = (await dsRes.json()) as {
          dataSource?: { dataStreamId: string; dataType?: { name: string } }[];
        };
        const discovered = (dsData.dataSource ?? [])
          .filter(
            (s) =>
              s.dataType?.name === "com.google.sleep.segment" ||
              s.dataType?.name === "com.google.activity.segment" ||
              s.dataStreamId.toLowerCase().includes("sleep") ||
              s.dataStreamId.toLowerCase().includes("bedtime") ||
              s.dataStreamId.toLowerCase().includes("deskclock")
          )
          .map((s) => s.dataStreamId);
        
        sleepSources = Array.from(new Set([...sleepSources, ...discovered]));
      }
    } catch (e) {
      console.error("[GFit Sleep] DataSources discovery error:", e);
    }

    const rawPoints: Array<{ startMs: number; endMs: number; stage: number }> = [];

    // Query in 30-day chunks (Google Fit enforces maximum dataset query window)
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const windows = [
      { start: endMs - THIRTY_DAYS, end: endMs },
      { start: endMs - 2 * THIRTY_DAYS, end: endMs - THIRTY_DAYS },
    ];

    for (const sourceId of sleepSources) {
      for (const win of windows) {
        try {
          const datasetId = `${win.start}000000-${win.end}000000`;
          const rawRes = await fetch(
            `https://www.googleapis.com/fitness/v1/users/me/dataSources/${encodeURIComponent(sourceId)}/datasets/${datasetId}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          if (rawRes.ok) {
            const rawData = (await rawRes.json()) as {
              point?: {
                startTimeNanos?: string;
                endTimeNanos?: string;
                value?: Array<{ intVal?: number }>;
              }[];
            };

            for (const point of rawData.point ?? []) {
              if (!point.startTimeNanos || !point.endTimeNanos) continue;
              const pStart = Number(BigInt(point.startTimeNanos) / BigInt(1_000_000));
              const pEnd = Number(BigInt(point.endTimeNanos) / BigInt(1_000_000));
              const stage = point.value?.[0]?.intVal ?? 2;

              // If activity segment, 72 is sleep; if sleep segment, 1 is awake and 3 is out-of-bed
              const isSleep = sourceId.includes("activity")
                ? stage === 72
                : (stage !== 1 && stage !== 3);

              if (isSleep && pEnd > pStart) {
                rawPoints.push({ startMs: pStart, endMs: pEnd, stage });
              }
            }
          }
        } catch (e) {
          console.error(`[GFit Sleep] Raw dataset fetch error for ${sourceId}:`, e);
        }
      }
    }

    // Sort all raw sleep points chronologically
    rawPoints.sort((a, b) => a.startMs - b.startMs);

    // Cluster points into nightly sleep sessions (gap between segments <= 3 hours)
    interface SleepCluster {
      startMs: number;
      endMs: number;
      sleepDurationMs: number;
    }
    const clusters: SleepCluster[] = [];

    for (const pt of rawPoints) {
      const isAwake = pt.stage === 1 || pt.stage === 3;
      const duration = pt.endMs - pt.startMs;
      const lastCluster = clusters[clusters.length - 1];

      if (lastCluster && pt.startMs - lastCluster.endMs <= 3 * 3600 * 1000) {
        lastCluster.endMs = Math.max(lastCluster.endMs, pt.endMs);
        if (!isAwake) lastCluster.sleepDurationMs += duration;
      } else {
        clusters.push({
          startMs: pt.startMs,
          endMs: pt.endMs,
          sleepDurationMs: isAwake ? 0 : duration,
        });
      }
    }

    for (const cl of clusters) {
      const effectiveDuration = cl.sleepDurationMs > 0 ? cl.sleepDurationMs : (cl.endMs - cl.startMs);
      if (effectiveDuration < 30 * 60 * 1000) continue;

      const hoursSlept = Math.round((effectiveDuration / (1000 * 3600)) * 10) / 10;
      const dateStr = new Date(cl.startMs).toISOString().split("T")[0];

      if (!datesWithSleep.has(dateStr)) {
        datesWithSleep.add(dateStr);
        sessions.push({
          id: `gfit_sleep_${cl.startMs}`,
          date: dateStr,
          bedtime: new Date(cl.startMs).toISOString(),
          wakeTime: new Date(cl.endMs).toISOString(),
          hoursSlept,
          quality: durationToSleepQuality(hoursSlept),
          notes: "Imported from Google Fit (Android Bedtime tracking)",
          isDemoData: false,
        });
      }
    }
  } catch (err) {
    console.error("[GFit Sleep] Segment discovery error:", err);
  }

  return sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ─── Nutrition fetching & mapping ───────────────────────────────────────────

/**
 * Google Fit data type: com.google.nutrition
 * Scope: https://www.googleapis.com/auth/fitness.nutrition.read
 *
 * Each point contains:
 * - mapVal: nutrients map (calories in kcal, protein, carbs.total, fat.total, fiber, etc.)
 * - intVal: meal_type (1: unknown, 2: breakfast, 3: lunch, 4: dinner, 5: snack)
 * - stringVal: food_item name
 *
 * We query both:
 * 1. Raw data sources for granular meals/food items.
 * 2. Dataset aggregate for daily nutrition totals.
 */

function extractNutrientsFromMap(
  mapEntries?: Array<{ key?: string; value?: { fpVal?: number } }>
): GoogleFitNutrientBreakdown {
  const nutrients: GoogleFitNutrientBreakdown = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  };

  if (!Array.isArray(mapEntries)) return nutrients;

  for (const entry of mapEntries) {
    const k = entry.key?.toLowerCase();
    const val = entry.value?.fpVal ?? 0;
    if (!k || val <= 0) continue;

    if (k === "calories") {
      nutrients.calories += Math.round(val * 10) / 10;
    } else if (k === "protein") {
      nutrients.protein += Math.round(val * 10) / 10;
    } else if (k === "carbs.total" || k === "carbs") {
      nutrients.carbs += Math.round(val * 10) / 10;
    } else if (k === "fat.total" || k === "fat") {
      nutrients.fat += Math.round(val * 10) / 10;
    } else if (k === "dietary_fiber" || k === "fiber") {
      nutrients.fiber = Math.round(((nutrients.fiber ?? 0) + val) * 10) / 10;
    } else if (k === "sugar") {
      nutrients.sugar = Math.round(((nutrients.sugar ?? 0) + val) * 10) / 10;
    } else if (k === "sodium") {
      nutrients.sodium = Math.round(((nutrients.sodium ?? 0) + val) * 10) / 10;
    }
  }

  return nutrients;
}

export async function fetchAndMapNutrition(
  accessToken: string,
  startMs: number,
  endMs: number
): Promise<GoogleFitNutritionData> {
  const emptyResult: GoogleFitNutritionData = {
    today: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    recentDays: [],
    meals: [],
    totalMealsCount: 0,
    lastSynced: Date.now(),
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const mealLogs: GoogleFitMealLog[] = [];
  const dailyMap = new Map<string, { nutrients: GoogleFitNutrientBreakdown; count: number }>();

  try {
    // 1. Discover nutrition data sources
    let nutritionSources: string[] = [];
    try {
      const dsRes = await fetch("https://www.googleapis.com/fitness/v1/users/me/dataSources", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (dsRes.ok) {
        const dsData = (await dsRes.json()) as {
          dataSource?: { dataStreamId: string; dataType?: { name: string } }[];
        };
        const sources = dsData.dataSource ?? [];
        nutritionSources = sources
          .filter(
            (s) =>
              s.dataType?.name === "com.google.nutrition" ||
              s.dataType?.name === "com.google.nutrition.summary"
          )
          .map((s) => s.dataStreamId);
      }
    } catch {
      // Ignore discovery errors, fall back to aggregate
    }

    // 2. Query raw datasets if sources found
    const MEAL_MAP: Record<number, GoogleFitMealLog["mealType"]> = {
      1: "unknown",
      2: "breakfast",
      3: "lunch",
      4: "dinner",
      5: "snack",
    };

    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const nutritionStart = Math.max(startMs, endMs - THIRTY_DAYS);

    for (const sourceId of nutritionSources) {
      try {
        const datasetId = `${nutritionStart}000000-${endMs}000000`;
        const rawRes = await fetch(
          `https://www.googleapis.com/fitness/v1/users/me/dataSources/${encodeURIComponent(sourceId)}/datasets/${datasetId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (rawRes.ok) {
          const rawData = (await rawRes.json()) as {
            point?: {
              startTimeNanos?: string;
              endTimeNanos?: string;
              value?: Array<{
                mapVal?: Array<{ key?: string; value?: { fpVal?: number } }>;
                intVal?: number;
                stringVal?: string;
              }>;
            }[];
          };

          for (const point of rawData.point ?? []) {
            let mapVal: Array<{ key?: string; value?: { fpVal?: number } }> | undefined;
            let mealTypeInt = 1;
            let foodName = "";

            for (const v of point.value ?? []) {
              if (v.mapVal) mapVal = v.mapVal;
              if (typeof v.intVal === "number") mealTypeInt = v.intVal;
              if (typeof v.stringVal === "string" && v.stringVal) foodName = v.stringVal;
            }

            if (!mapVal) continue;
            const nutrients = extractNutrientsFromMap(mapVal);
            if (nutrients.calories <= 0 && nutrients.protein <= 0 && nutrients.carbs <= 0 && nutrients.fat <= 0) {
              continue;
            }

            const nanos = point.startTimeNanos || point.endTimeNanos || "0";
            const timeMs = Number(BigInt(nanos) / BigInt(1_000_000));
            const dateObj = !isNaN(timeMs) && timeMs > 0 ? new Date(timeMs) : new Date();
            const dateStr = dateObj.toISOString().split("T")[0];
            const timeStr = `${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}`;
            const mealType = MEAL_MAP[mealTypeInt] ?? "unknown";

            mealLogs.push({
              id: `gfit_meal_${nanos}_${mealLogs.length}`,
              date: dateStr,
              time: timeStr,
              mealType,
              name:
                foodName ||
                (mealType !== "unknown"
                  ? mealType.charAt(0).toUpperCase() + mealType.slice(1)
                  : "Logged Meal"),
              nutrients,
            });

            // Aggregate into dailyMap
            const existing = dailyMap.get(dateStr) ?? {
              nutrients: { calories: 0, protein: 0, carbs: 0, fat: 0 },
              count: 0,
            };
            existing.nutrients.calories += nutrients.calories;
            existing.nutrients.protein += nutrients.protein;
            existing.nutrients.carbs += nutrients.carbs;
            existing.nutrients.fat += nutrients.fat;
            if (nutrients.fiber) existing.nutrients.fiber = (existing.nutrients.fiber ?? 0) + nutrients.fiber;
            if (nutrients.sugar) existing.nutrients.sugar = (existing.nutrients.sugar ?? 0) + nutrients.sugar;
            if (nutrients.sodium) existing.nutrients.sodium = (existing.nutrients.sodium ?? 0) + nutrients.sodium;
            existing.count += 1;
            dailyMap.set(dateStr, existing);
          }
        }
      } catch (err) {
        console.warn(`[GFit Nutrition] Source ${sourceId} fetch failed:`, err);
      }
    }

    // 3. If raw source yielded no meals, run dataset:aggregate
    if (mealLogs.length === 0) {
      let aggRes = await fetch("https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          aggregateBy: [{ dataTypeName: "com.google.nutrition.summary" }],
          bucketByTime: { durationMillis: "86400000" },
          startTimeMillis: String(startMs),
          endTimeMillis: String(endMs),
        }),
      });

      if (!aggRes.ok) {
        aggRes = await fetch("https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            aggregateBy: [{ dataTypeName: "com.google.nutrition" }],
            bucketByTime: { durationMillis: "86400000" },
            startTimeMillis: String(startMs),
            endTimeMillis: String(endMs),
          }),
        });
      }

      if (aggRes.ok) {
        const aggData = (await aggRes.json()) as {
          bucket?: {
            startTimeMillis: string;
            dataset?: {
              point?: {
                value?: Array<{
                  mapVal?: Array<{ key?: string; value?: { fpVal?: number } }>;
                }>;
              }[];
            }[];
          }[];
        };

        for (const bucket of aggData.bucket ?? []) {
          const bStartMs = Number(bucket.startTimeMillis);
          const dateStr = new Date(bStartMs).toISOString().split("T")[0];
          let bucketNutrients: GoogleFitNutrientBreakdown = {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
          };
          let count = 0;

          for (const ds of bucket.dataset ?? []) {
            for (const pt of ds.point ?? []) {
              for (const v of pt.value ?? []) {
                if (v.mapVal) {
                  const n = extractNutrientsFromMap(v.mapVal);
                  if (n.calories > 0 || n.protein > 0 || n.carbs > 0 || n.fat > 0) {
                    bucketNutrients.calories += n.calories;
                    bucketNutrients.protein += n.protein;
                    bucketNutrients.carbs += n.carbs;
                    bucketNutrients.fat += n.fat;
                    if (n.fiber) bucketNutrients.fiber = (bucketNutrients.fiber ?? 0) + n.fiber;
                    if (n.sugar) bucketNutrients.sugar = (bucketNutrients.sugar ?? 0) + n.sugar;
                    if (n.sodium) bucketNutrients.sodium = (bucketNutrients.sodium ?? 0) + n.sodium;
                    count++;
                  }
                }
              }
            }
          }

          if (count > 0) {
            dailyMap.set(dateStr, { nutrients: bucketNutrients, count });
          }
        }
      }
    }

    // Build recentDays array sorted descending
    const recentDays = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        nutrients: {
          calories: Math.round(data.nutrients.calories),
          protein: Math.round(data.nutrients.protein),
          carbs: Math.round(data.nutrients.carbs),
          fat: Math.round(data.nutrients.fat),
          fiber: data.nutrients.fiber ? Math.round(data.nutrients.fiber) : undefined,
          sugar: data.nutrients.sugar ? Math.round(data.nutrients.sugar) : undefined,
          sodium: data.nutrients.sodium ? Math.round(data.nutrients.sodium) : undefined,
        },
        mealCount: data.count,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Today's nutrients: if today has an entry use it, otherwise most recent day within 48h
    const todayEntry = recentDays.find((d) => d.date === todayStr);
    const fallbackEntry = recentDays[0];
    const todayNutrients: GoogleFitNutrientBreakdown = todayEntry
      ? todayEntry.nutrients
      : fallbackEntry && (Date.now() - new Date(fallbackEntry.date).getTime() < 48 * 3600 * 1000)
      ? fallbackEntry.nutrients
      : { calories: 0, protein: 0, carbs: 0, fat: 0 };

    return {
      today: todayNutrients,
      recentDays,
      meals: mealLogs.sort((a, b) => new Date(`${b.date}T${b.time || "00:00"}`).getTime() - new Date(`${a.date}T${a.time || "00:00"}`).getTime()),
      totalMealsCount: mealLogs.length || recentDays.reduce((acc, d) => acc + d.mealCount, 0),
      lastSynced: Date.now(),
    };
  } catch (err) {
    console.error("[GFit Nutrition] Fetch error:", err);
    return emptyResult;
  }
}


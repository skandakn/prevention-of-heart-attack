/**
 * Demo Data Generators for Fit & Rest Agent
 * 
 * Generates realistic simulated workout and sleep data for demo/preview purposes.
 * All generated data is marked with isDemoData: true.
 * 
 * IMPORTANT: Demo data must always be clearly labeled as "DEMO MODE — SIMULATED DATA"
 * in the UI. Never present simulated data as real measurements.
 */

import type {
  WorkoutSession,
  SleepSession,
  RecoveryState,
  ExerciseType,
  WorkoutIntensity,
  SleepQuality,
} from "./types";

// ─── Helper Functions ─────────────────────────────────────────────────────────

function subDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Workout Demo Data ────────────────────────────────────────────────────────

/**
 * Generates 10 workouts of demo workout history
 * Creates varied workouts with realistic patterns:
 * - Mix of exercise types
 * - Varied intensities (with rest days)
 * - Realistic durations
 * - All marked as demo data
 */
export function generateDemoWorkoutHistory(): WorkoutSession[] {
  const today = new Date();
  const workouts: WorkoutSession[] = [];

  const exerciseTypes: ExerciseType[] = [
    "running",
    "weightlifting",
    "yoga",
    "cycling",
    "bodyweight",
    "hiit",
    "walking",
  ];

  const intensityDistribution: WorkoutIntensity[] = [
    "light",
    "light",
    "moderate",
    "moderate",
    "moderate",
    "intense",
  ];

  // Generate 10 workouts over the last 14 days (some days are rest days)
  const daysToGenerate = [1, 2, 3, 5, 6, 8, 9, 10, 12, 13];

  daysToGenerate.forEach((daysAgo, index) => {
    const date = subDays(today, daysAgo);
    const type = getRandomElement(exerciseTypes);
    const intensity = getRandomElement(intensityDistribution);

    // Duration based on intensity and type
    let duration: number;
    if (type === "walking" || type === "yoga") {
      duration = getRandomInt(20, 45);
    } else if (intensity === "light") {
      duration = getRandomInt(20, 35);
    } else if (intensity === "moderate") {
      duration = getRandomInt(30, 50);
    } else {
      duration = getRandomInt(40, 65);
    }

    // Generate contextual notes
    let notes = "";
    if (type === "weightlifting") {
      notes = ["Upper body focus", "Lower body day", "Full body workout", "Core emphasis"][
        index % 4
      ];
    } else if (type === "running") {
      notes = ["Easy pace", "Interval training", "Long slow distance", "Tempo run"][index % 4];
    } else if (type === "hiit") {
      notes = "High intensity circuits";
    } else if (type === "yoga") {
      notes = ["Vinyasa flow", "Gentle stretching", "Power yoga", "Restorative"][index % 4];
    }

    workouts.push({
      id: `demo-w${index + 1}`,
      date: date.toISOString().split("T")[0], // YYYY-MM-DD format
      type,
      durationMinutes: duration,
      intensity,
      notes: notes || undefined,
      isDemoData: true, // ✅ Clearly marked as demo
    });
  });

  // Sort by date (most recent first)
  workouts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return workouts;
}

// ─── Sleep Demo Data ──────────────────────────────────────────────────────────

/**
 * Generates 14 days of demo sleep history
 * Creates varied sleep data with realistic patterns:
 * - Mix of sleep qualities
 * - Realistic sleep durations (5-9 hours)
 * - Varied bedtimes and wake times
 * - All marked as demo data
 */
export function generateDemoSleepHistory(): SleepSession[] {
  const today = new Date();
  const sleep: SleepSession[] = [];

  const qualityDistribution: SleepQuality[] = [
    "excellent",
    "good",
    "good",
    "good",
    "fair",
    "fair",
    "poor",
  ];

  // Generate sleep for last 14 nights
  for (let daysAgo = 1; daysAgo <= 14; daysAgo++) {
    const sleepDate = subDays(today, daysAgo);
    const quality = getRandomElement(qualityDistribution);

    // Bedtime between 21:00 and 01:00
    const bedtimeHour = getRandomInt(21, 25) % 24; // 21-23 or 0 (midnight)
    const bedtimeMinute = getRandomInt(0, 5) * 10; // 0, 10, 20, 30, 40, 50
    const bedtime = new Date(sleepDate);
    bedtime.setHours(bedtimeHour, bedtimeMinute, 0, 0);
    if (bedtimeHour < 12) {
      // If after midnight, it's technically next day
      bedtime.setDate(bedtime.getDate() + 1);
    }

    // Sleep duration based on quality
    let hoursSlept: number;
    if (quality === "excellent") {
      hoursSlept = getRandomInt(75, 90) / 10; // 7.5-9.0 hours
    } else if (quality === "good") {
      hoursSlept = getRandomInt(70, 85) / 10; // 7.0-8.5 hours
    } else if (quality === "fair") {
      hoursSlept = getRandomInt(60, 75) / 10; // 6.0-7.5 hours
    } else {
      hoursSlept = getRandomInt(45, 65) / 10; // 4.5-6.5 hours
    }

    // Calculate wake time
    const wakeTime = new Date(bedtime.getTime() + hoursSlept * 60 * 60 * 1000);

    // Generate contextual notes
    let notes = "";
    if (quality === "poor") {
      notes = ["Woke up multiple times", "Had trouble falling asleep", "Restless night"][
        daysAgo % 3
      ];
    } else if (quality === "fair") {
      notes = ["Woke up once", "Took a while to fall asleep", "Light sleep"][daysAgo % 3];
    }

    sleep.push({
      id: `demo-s${daysAgo}`,
      date: sleepDate.toISOString().split("T")[0], // YYYY-MM-DD format
      bedtime: bedtime.toISOString(),
      wakeTime: wakeTime.toISOString(),
      hoursSlept: Math.round(hoursSlept * 10) / 10, // Round to 1 decimal
      quality,
      notes: notes || undefined,
      isDemoData: true, // ✅ Clearly marked as demo
    });
  }

  // Sort by date (most recent first)
  sleep.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return sleep;
}

// ─── Recovery State Computation ───────────────────────────────────────────────

/**
 * Computes recovery state from workout and sleep history
 * Analyzes last 7 days to provide context for coordinated recommendations
 * 
 * IMPORTANT: This does NOT calculate or modify ISI.
 * It only analyzes user's logged workout and sleep data.
 */
export function computeRecoveryState(
  workouts: WorkoutSession[],
  sleep: SleepSession[],
  targetSleepHours: number = 8
): RecoveryState {
  const now = new Date();
  const sevenDaysAgo = subDays(now, 7);

  // Filter to last 7 days
  const recentWorkouts = workouts.filter((w) => {
    const workoutDate = new Date(w.date);
    return workoutDate >= sevenDaysAgo && workoutDate <= now;
  });

  const recentSleep = sleep.filter((s) => {
    const sleepDate = new Date(s.date);
    return sleepDate >= sevenDaysAgo && sleepDate <= now;
  });

  // ── Workout metrics ────────────────────────────────────────────────────────

  const workoutCount = recentWorkouts.length;
  const intenseWorkoutCount = recentWorkouts.filter(
    (w) => w.intensity === "moderate" || w.intensity === "intense"
  ).length;
  const totalWorkoutMinutes = recentWorkouts.reduce(
    (sum, w) => sum + w.durationMinutes,
    0
  );

  // ── Sleep metrics ──────────────────────────────────────────────────────────

  const sleepCount = recentSleep.length;
  const avgSleepHours =
    sleepCount > 0
      ? recentSleep.reduce((sum, s) => sum + s.hoursSlept, 0) / sleepCount
      : 0;

  const consistentNights = recentSleep.filter(
    (s) => s.hoursSlept >= 7 && s.hoursSlept <= 9
  ).length;
  const sleepConsistencyPercent = sleepCount > 0 ? (consistentNights / 7) * 100 : 0;

  const targetWeeklySleep = targetSleepHours * 7;
  const actualWeeklySleep = recentSleep.reduce((sum, s) => sum + s.hoursSlept, 0);
  const sleepDebtHours = Math.max(0, targetWeeklySleep - actualWeeklySleep);

  // ── Build context summaries ────────────────────────────────────────────────

  let workoutSummary = "";
  if (workoutCount === 0) {
    workoutSummary = "No workouts logged in the last 7 days";
  } else if (workoutCount === 1) {
    workoutSummary = `1 workout (${totalWorkoutMinutes} minutes total)`;
  } else {
    const intenseText =
      intenseWorkoutCount > 0 ? `, ${intenseWorkoutCount} moderate/intense` : "";
    workoutSummary = `${workoutCount} workouts${intenseText} (${totalWorkoutMinutes} minutes total)`;
  }

  let sleepSummary = "";
  if (sleepCount === 0) {
    sleepSummary = "No sleep data logged in the last 7 days";
  } else {
    const avgText = `Avg ${avgSleepHours.toFixed(1)} hours/night`;
    const consistencyText = `${Math.round(sleepConsistencyPercent)}% consistency`;
    const debtText =
      sleepDebtHours > 0 ? `, ${sleepDebtHours.toFixed(1)}h sleep debt` : "";
    sleepSummary = `${avgText}, ${consistencyText}${debtText}`;
  }

  return {
    workoutCount,
    intenseWorkoutCount,
    totalWorkoutMinutes,
    avgSleepHours: Math.round(avgSleepHours * 10) / 10, // Round to 1 decimal
    sleepConsistencyPercent: Math.round(sleepConsistencyPercent),
    sleepDebtHours: Math.round(sleepDebtHours * 10) / 10, // Round to 1 decimal
    recentWorkoutSummary: workoutSummary,
    recentSleepSummary: sleepSummary,
  };
}

// ─── Utility: Check if date is within last N days ─────────────────────────────

export function isWithinLastNDays(dateString: string, days: number): boolean {
  const date = new Date(dateString);
  const now = new Date();
  const nDaysAgo = subDays(now, days);
  return date >= nDaysAgo && date <= now;
}

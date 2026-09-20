/**
 * Fit & Rest Agent Type Definitions
 * 
 * IMPORTANT NOTES:
 * - Reuses existing user profile data (age, height, weight, activityLevel from Nutri Agent)
 * - ISI context is READ-ONLY from SimulationContext
 * - No new ISI thresholds, calculations, or medical decision rules
 * - All demo data must be clearly marked with isDemoData flag
 */

// ─── Fitness Types ────────────────────────────────────────────────────────────

export type FitnessLevel = "beginner" | "intermediate" | "advanced";

export type FitnessGoal =
  | "strength"
  | "cardio"
  | "flexibility"
  | "weight_loss"
  | "muscle_gain"
  | "endurance"
  | "general_fitness";

export type ExerciseType =
  | "bodyweight"
  | "weightlifting"
  | "running"
  | "cycling"
  | "swimming"
  | "yoga"
  | "pilates"
  | "sports"
  | "hiit"
  | "walking";

export type Equipment =
  | "none"
  | "dumbbells"
  | "resistance_bands"
  | "pull_up_bar"
  | "yoga_mat"
  | "full_gym_access";

export type WorkoutIntensity = "light" | "moderate" | "intense";

// ─── Rest/Sleep Types ─────────────────────────────────────────────────────────

export type SleepGoal =
  | "improve_quality"
  | "increase_duration"
  | "better_consistency"
  | "faster_falling_asleep"
  | "reduce_night_waking"
  | "improve_recovery";

export type RecoveryGoal =
  | "muscle_recovery"
  | "reduce_fatigue"
  | "stress_management"
  | "injury_recovery"
  | "general_wellness";

export type SleepChallenge =
  | "difficulty_falling_asleep"
  | "waking_during_night"
  | "early_waking"
  | "poor_quality"
  | "irregular_schedule";

export type SleepQuality = "poor" | "fair" | "good" | "excellent";

export type RecoveryActivity =
  | "meditation"
  | "stretching"
  | "foam_rolling"
  | "massage"
  | "reading"
  | "warm_bath"
  | "breathing_exercises"
  | "gentle_yoga";

// ─── Intent Types ─────────────────────────────────────────────────────────────

export type FitnessIntent =
  | "chat"
  | "workout_plan"
  | "recommendations"
  | "explain";

export type RestIntent =
  | "chat"
  | "bedtime_routine"
  | "recommendations"
  | "explain";

// ─── Profile Interfaces ───────────────────────────────────────────────────────

/**
 * Fitness Profile
 * Contains fitness-specific preferences only.
 * Age, height, weight, base activity level are in existing user profile.
 * No medical intake fields - this is a wellness assistant, not medical questionnaire.
 */
export interface FitnessProfile {
  // Experience & level
  fitnessLevel: FitnessLevel;
  experienceMonths: number;

  // Fitness goals (multi-select)
  goals: FitnessGoal[];

  // Preferred activities (multi-select)
  preferredActivities: ExerciseType[];

  // Schedule & availability
  workoutsPerWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  availableTimeMinutes: 15 | 20 | 30 | 45 | 60 | 90;

  // Equipment available (multi-select)
  availableEquipment: Equipment[];

  // Status
  isProfileComplete: boolean;
}

/**
 * Rest Profile
 * Contains sleep and recovery preferences.
 */
export interface RestProfile {
  // Sleep schedule
  targetSleepHours: 6 | 7 | 8 | 9;
  typicalBedtime: string; // "20:00", "21:00", "22:00", "23:00", "00:00", "01:00"
  typicalWakeTime: string; // "05:00", "06:00", "07:00", "08:00", "09:00"

  // Sleep goals (multi-select)
  sleepGoals: SleepGoal[];

  // Recovery goals (multi-select)
  recoveryGoals: RecoveryGoal[];

  // Challenges (multi-select)
  sleepChallenges: SleepChallenge[];

  // Preferred recovery activities (multi-select)
  preferredRecoveryActivities: RecoveryActivity[];

  // Status
  isProfileComplete: boolean;
}

// ─── Session/History Interfaces ───────────────────────────────────────────────

/**
 * Workout Session
 * Represents a single workout entry (real or demo).
 */
export interface WorkoutSession {
  id: string;
  date: string; // ISO date string
  type: ExerciseType;
  durationMinutes: number;
  intensity: WorkoutIntensity;
  notes?: string;
  isDemoData: boolean; // IMPORTANT: Must be true for simulated data
}

/**
 * Sleep Session
 * Represents a single sleep entry (real or demo).
 */
export interface SleepSession {
  id: string;
  date: string; // ISO date string (sleep date, not bedtime date)
  bedtime: string; // ISO datetime string
  wakeTime: string; // ISO datetime string
  hoursSlept: number;
  quality: SleepQuality;
  notes?: string;
  isDemoData: boolean; // IMPORTANT: Must be true for simulated data
}

// ─── Recovery State ───────────────────────────────────────────────────────────

/**
 * Recovery State
 * Computed from workout and sleep history (last 7 days).
 * Used to coordinate fitness and rest recommendations.
 * 
 * IMPORTANT: Does NOT calculate or modify ISI.
 */
export interface RecoveryState {
  // Computed from workout history (last 7 days)
  workoutCount: number;
  intenseWorkoutCount: number; // moderate or intense workouts
  totalWorkoutMinutes: number;

  // Computed from sleep history (last 7 days)
  avgSleepHours: number;
  sleepConsistencyPercent: number; // % of nights with 7-9 hours
  sleepDebtHours: number; // (target × 7) - actual

  // Context summaries for AI (plain text)
  recentWorkoutSummary: string; // e.g., "3 workouts (2 intense), 120 total minutes"
  recentSleepSummary: string; // e.g., "Avg 6.5 hours, 43% consistency, 3.5 hours debt"
}

// ─── ISI Context ──────────────────────────────────────────────────────────────

/**
 * Minimal ISI Context for Fit & Rest Agent
 * 
 * CRITICAL: This is READ-ONLY from useSimulation().
 * 
 * This interface contains ONLY the minimum information needed for wellness recommendations.
 * Raw physiological values (HR, HRV, SpO2) are NOT exposed to AI to minimize unnecessary
 * medical interpretation.
 * 
 * Fit & Rest Agent must NEVER:
 * - Calculate ISI scores
 * - Interpret ISI thresholds (beyond existing BeatAhead scenarios)
 * - Create new medical decision rules based on ISI
 * - Modify ISI scores
 * - Override ISI warnings
 * 
 * It may only:
 * - Read current ISI context from useSimulation()
 * - Pass minimal context to AI for informational awareness
 * - Respect existing BeatAhead safety warnings (e.g., persistent_rising scenario)
 */
export interface FitRestISIContext {
  // Wellness indicator (read-only from BeatAhead ISI system)
  score: number;
  trend: "increasing" | "decreasing" | "stable";
  label: string; // from getISILabel() utility (e.g., "Intermediate observed trend")
  
  // Scenario context (read-only from BeatAhead simulation)
  scenario: string; // e.g., "normal", "persistent_rising"
  
  // Signal quality (for data reliability context)
  signalQuality: number; // 0-100%
}

// ─── Chat Message ─────────────────────────────────────────────────────────────

export interface FitRestMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  intent?: FitnessIntent | RestIntent;
}

// ─── Default Profiles ─────────────────────────────────────────────────────────

export const DEFAULT_FITNESS_PROFILE: FitnessProfile = {
  fitnessLevel: "beginner",
  experienceMonths: 0,
  goals: ["general_fitness"],
  preferredActivities: [],
  workoutsPerWeek: 3,
  availableTimeMinutes: 30,
  availableEquipment: ["none"],
  isProfileComplete: false,
};

export const DEFAULT_REST_PROFILE: RestProfile = {
  targetSleepHours: 8,
  typicalBedtime: "23:00",
  typicalWakeTime: "07:00",
  sleepGoals: [],
  recoveryGoals: [],
  sleepChallenges: [],
  preferredRecoveryActivities: [],
  isProfileComplete: false,
};

// ─── Storage Keys ─────────────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  FITNESS_PROFILE: "beatahead-fitness-profile",
  REST_PROFILE: "beatahead-rest-profile",
  WORKOUT_HISTORY: "beatahead-workout-history",
  SLEEP_HISTORY: "beatahead-sleep-history",
} as const;

// ─── Label Maps ───────────────────────────────────────────────────────────────

export const FITNESS_LEVEL_LABELS: Record<FitnessLevel, string> = {
  beginner: "Beginner (0-6 months)",
  intermediate: "Intermediate (6-24 months)",
  advanced: "Advanced (2+ years)",
};

export const FITNESS_GOAL_LABELS: Record<FitnessGoal, string> = {
  strength: "Build strength",
  cardio: "Improve cardiovascular fitness",
  flexibility: "Increase flexibility",
  weight_loss: "Weight management",
  muscle_gain: "Build muscle mass",
  endurance: "Improve endurance",
  general_fitness: "General fitness & health",
};

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  bodyweight: "Bodyweight exercises",
  weightlifting: "Weightlifting",
  running: "Running",
  cycling: "Cycling",
  swimming: "Swimming",
  yoga: "Yoga",
  pilates: "Pilates",
  sports: "Sports",
  hiit: "HIIT",
  walking: "Walking",
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  none: "No equipment (bodyweight only)",
  dumbbells: "Dumbbells",
  resistance_bands: "Resistance bands",
  pull_up_bar: "Pull-up bar",
  yoga_mat: "Yoga mat",
  full_gym_access: "Full gym access",
};

export const SLEEP_GOAL_LABELS: Record<SleepGoal, string> = {
  improve_quality: "Improve sleep quality",
  increase_duration: "Increase sleep duration",
  better_consistency: "Better sleep consistency",
  faster_falling_asleep: "Fall asleep faster",
  reduce_night_waking: "Reduce night waking",
  improve_recovery: "Improve recovery",
};

export const RECOVERY_GOAL_LABELS: Record<RecoveryGoal, string> = {
  muscle_recovery: "Muscle recovery",
  reduce_fatigue: "Reduce fatigue",
  stress_management: "Stress management",
  injury_recovery: "Injury recovery",
  general_wellness: "General wellness",
};

export const SLEEP_CHALLENGE_LABELS: Record<SleepChallenge, string> = {
  difficulty_falling_asleep: "Difficulty falling asleep",
  waking_during_night: "Waking during the night",
  early_waking: "Waking too early",
  poor_quality: "Poor sleep quality",
  irregular_schedule: "Irregular sleep schedule",
};

export const RECOVERY_ACTIVITY_LABELS: Record<RecoveryActivity, string> = {
  meditation: "Meditation",
  stretching: "Stretching",
  foam_rolling: "Foam rolling",
  massage: "Massage",
  reading: "Reading",
  warm_bath: "Warm bath",
  breathing_exercises: "Breathing exercises",
  gentle_yoga: "Gentle yoga",
};

export const WORKOUT_TIME_OPTIONS: { value: 15 | 20 | 30 | 45 | 60 | 90; label: string }[] = [
  { value: 15, label: "15 minutes" },
  { value: 20, label: "20 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 45, label: "45 minutes" },
  { value: 60, label: "60 minutes" },
  { value: 90, label: "90 minutes" },
];

export const WORKOUTS_PER_WEEK_OPTIONS: { value: 1 | 2 | 3 | 4 | 5 | 6 | 7; label: string }[] = [
  { value: 1, label: "1x/week" },
  { value: 2, label: "2x/week" },
  { value: 3, label: "3x/week" },
  { value: 4, label: "4x/week" },
  { value: 5, label: "5x/week" },
  { value: 6, label: "6x/week" },
  { value: 7, label: "7x/week" },
];

export const TARGET_SLEEP_OPTIONS: { value: 6 | 7 | 8 | 9; label: string }[] = [
  { value: 6, label: "6 hours" },
  { value: 7, label: "7 hours" },
  { value: 8, label: "8 hours" },
  { value: 9, label: "9 hours" },
];

export const BEDTIME_OPTIONS: { value: string; label: string }[] = [
  { value: "20:00", label: "8:00 PM" },
  { value: "21:00", label: "9:00 PM" },
  { value: "22:00", label: "10:00 PM" },
  { value: "23:00", label: "11:00 PM" },
  { value: "00:00", label: "12:00 AM" },
  { value: "01:00", label: "1:00 AM" },
];

export const WAKE_TIME_OPTIONS: { value: string; label: string }[] = [
  { value: "05:00", label: "5:00 AM" },
  { value: "06:00", label: "6:00 AM" },
  { value: "07:00", label: "7:00 AM" },
  { value: "08:00", label: "8:00 AM" },
  { value: "09:00", label: "9:00 AM" },
];

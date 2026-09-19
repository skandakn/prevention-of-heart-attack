// ─── Nutri Agent types ───────────────────────────────────────────────────────
// Server and client safe — no React imports.

export type DietaryPreference =
  | "none"
  | "omnivore"
  | "vegetarian"
  | "vegan"
  | "pescatarian"
  | "gluten_free"
  | "dairy_free"
  | "keto"
  | "paleo";

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export type WellnessGoal =
  | "general_wellness"
  | "weight_management"
  | "energy_levels"
  | "heart_health"
  | "stress_reduction"
  | "better_sleep"
  | "digestive_health";

export type NutriIntent =
  | "chat"
  | "daily_plan"
  | "recommendations"
  | "explain";

// ─── Persisted user profile ───────────────────────────────────────────────────

export interface NutriProfile {
  dietaryPreference: DietaryPreference;
  activityLevel: ActivityLevel;
  goals: WellnessGoal[];
  allergens: string;
  mealsPerDay: 2 | 3 | 4 | 5;
  isProfileComplete: boolean;
}

export const DEFAULT_NUTRI_PROFILE: NutriProfile = {
  dietaryPreference: "none",
  activityLevel: "moderate",
  goals: ["general_wellness"],
  allergens: "",
  mealsPerDay: 3,
  isProfileComplete: false,
};

// ─── Chat message ─────────────────────────────────────────────────────────────

export interface NutriMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  intent?: NutriIntent;
}

// ─── ISI context snapshot sent to the server-side API ────────────────────────

export interface NutriISIContext {
  score: number;
  trend: "increasing" | "decreasing" | "stable";
  baseline: number;
  label: string;
  heartRate: number;
  hrv: number;
  spo2: number;
  scenario: string;
  signalQuality: number;
}

// ─── Display label maps ───────────────────────────────────────────────────────

export const DIETARY_PREFERENCE_LABELS: Record<DietaryPreference, string> = {
  none: "No preference",
  omnivore: "Omnivore",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  pescatarian: "Pescatarian",
  gluten_free: "Gluten-free",
  dairy_free: "Dairy-free",
  keto: "Ketogenic",
  paleo: "Paleo",
};

export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary (mostly sitting)",
  light: "Light activity (1–3 days/week)",
  moderate: "Moderate activity (3–5 days/week)",
  active: "Active (6–7 days/week)",
  very_active: "Very active (twice daily)",
};

export const WELLNESS_GOAL_LABELS: Record<WellnessGoal, string> = {
  general_wellness: "General wellness",
  weight_management: "Weight management",
  energy_levels: "Energy levels",
  heart_health: "Heart health",
  stress_reduction: "Stress reduction",
  better_sleep: "Better sleep",
  digestive_health: "Digestive health",
};

export const MEALS_PER_DAY_OPTIONS: { value: 2 | 3 | 4 | 5; label: string }[] = [
  { value: 2, label: "2 meals/day" },
  { value: 3, label: "3 meals/day" },
  { value: 4, label: "4 meals/day" },
  { value: 5, label: "5 meals/day" },
];

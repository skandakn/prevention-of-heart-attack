"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  FitnessProfile,
  RestProfile,
  WorkoutSession,
  SleepSession,
  RecoveryState,
  GoogleFitNutritionData,
} from "./types";
import {
  DEFAULT_FITNESS_PROFILE,
  DEFAULT_REST_PROFILE,
  STORAGE_KEYS,
} from "./types";
import {
  computeRecoveryState,
} from "./demo-data";

// ─── Google Fit token shape (stored in localStorage) ─────────────────────────

export interface GoogleFitToken {
  access_token: string;
  refresh_token: string | null;
  expires_at: number;
}

const GFIT_TOKEN_KEY = "beatahead-gfit-token";
const GFIT_SYNCED_KEY = "beatahead-gfit-synced";

// ─── Context Shape ────────────────────────────────────────────────────────────

interface FitRestContextValue {
  // Fitness state
  fitnessProfile: FitnessProfile;
  updateFitnessProfile: (partial: Partial<FitnessProfile>) => void;
  workoutHistory: WorkoutSession[];
  addWorkout: (workout: Omit<WorkoutSession, "id">) => void;
  deleteWorkout: (id: string) => void;

  // Rest state
  restProfile: RestProfile;
  updateRestProfile: (partial: Partial<RestProfile>) => void;
  sleepHistory: SleepSession[];
  addSleep: (sleep: Omit<SleepSession, "id">) => void;
  deleteSleep: (id: string) => void;

  // Shared recovery state (computed)
  recoveryState: RecoveryState;

  // Demo mode indicator (read-only)
  isDemoMode: boolean;

  // Google Fit integration
  googleFitConnected: boolean;
  googleFitLastSynced: number | null;  // epoch ms
  googleFitSyncing: boolean;
  googleFitError: string | null;
  googleFitNutrition: GoogleFitNutritionData | null;
  syncGoogleFit: () => Promise<void>;
  disconnectGoogleFit: () => void;
}

const FitRestContext = createContext<FitRestContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function FitRestProvider({ children }: { children: React.ReactNode }) {
  // ── State ──────────────────────────────────────────────────────────────────

  const [fitnessProfile, setFitnessProfile] = useState<FitnessProfile>(
    DEFAULT_FITNESS_PROFILE
  );
  const [restProfile, setRestProfile] = useState<RestProfile>(DEFAULT_REST_PROFILE);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);
  const [sleepHistory, setSleepHistory] = useState<SleepSession[]>([]);

  // ── Google Fit state ───────────────────────────────────────────────────────
  const [googleFitToken, setGoogleFitToken] = useState<GoogleFitToken | null>(null);
  const [googleFitLastSynced, setGoogleFitLastSynced] = useState<number | null>(null);
  const [googleFitSyncing, setGoogleFitSyncing] = useState(false);
  const [googleFitError, setGoogleFitError] = useState<string | null>(null);
  const [googleFitNutrition, setGoogleFitNutrition] = useState<GoogleFitNutritionData | null>(null);

  // ── Load from localStorage on mount ───────────────────────────────────────

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      // Load fitness profile
      const storedFitnessProfile = localStorage.getItem(STORAGE_KEYS.FITNESS_PROFILE);
      if (storedFitnessProfile) {
        const parsed = JSON.parse(storedFitnessProfile) as Partial<FitnessProfile>;
        setFitnessProfile((prev) => ({ ...prev, ...parsed }));
      }

      // Load rest profile
      const storedRestProfile = localStorage.getItem(STORAGE_KEYS.REST_PROFILE);
      if (storedRestProfile) {
        const parsed = JSON.parse(storedRestProfile) as Partial<RestProfile>;
        setRestProfile((prev) => ({ ...prev, ...parsed }));
      }

      // Load workout history — start empty if none stored or if all entries are demo data
      const storedWorkouts = localStorage.getItem(STORAGE_KEYS.WORKOUT_HISTORY);
      if (storedWorkouts) {
        try {
          const parsed = JSON.parse(storedWorkouts) as WorkoutSession[];
          if (Array.isArray(parsed)) {
            // Strip out any demo/synthetic entries — only keep real data
            const real = parsed.filter((w) => !w.isDemoData);
            setWorkoutHistory(real);
            // Persist stripped list back so demo entries don't re-appear on reload
            localStorage.setItem(STORAGE_KEYS.WORKOUT_HISTORY, JSON.stringify(real));
          }
        } catch {
          setWorkoutHistory([]);
        }
      }

      // Load sleep history — start empty if none stored or if all entries are demo data
      const storedSleep = localStorage.getItem(STORAGE_KEYS.SLEEP_HISTORY);
      if (storedSleep) {
        try {
          const parsed = JSON.parse(storedSleep) as SleepSession[];
          if (Array.isArray(parsed)) {
            // Strip out any demo/synthetic entries — only keep real data
            const real = parsed.filter((s) => !s.isDemoData);
            setSleepHistory(real);
            localStorage.setItem(STORAGE_KEYS.SLEEP_HISTORY, JSON.stringify(real));
          }
        } catch {
          setSleepHistory([]);
        }
      }

      // Load Google Fit nutrition (if previously synced)
      const storedNutrition = localStorage.getItem(STORAGE_KEYS.NUTRITION_HISTORY);
      if (storedNutrition) {
        try {
          setGoogleFitNutrition(JSON.parse(storedNutrition) as GoogleFitNutritionData);
        } catch {
          localStorage.removeItem(STORAGE_KEYS.NUTRITION_HISTORY);
        }
      }

      // ── Load Google Fit token (if previously connected) ───────────────────
      const storedToken = localStorage.getItem(GFIT_TOKEN_KEY);
      if (storedToken) {
        try {
          setGoogleFitToken(JSON.parse(storedToken) as GoogleFitToken);
        } catch {
          localStorage.removeItem(GFIT_TOKEN_KEY);
        }
      }

      // ── Load last synced timestamp ────────────────────────────────────────
      const lastSynced = localStorage.getItem(GFIT_SYNCED_KEY);
      if (lastSynced) {
        const ts = Number(lastSynced);
        if (!isNaN(ts)) setGoogleFitLastSynced(ts);
      }

      // ── Handle OAuth redirect: ?gfit_data=<base64> ───────────────────────
      // The callback route encodes token + workouts as a base64 URL param.
      // We decode it here, write everything to localStorage, and update state —
      // then clean the URL so refreshing doesn't re-apply stale data.
      const urlParams = new URLSearchParams(window.location.search);
      const gfitData = urlParams.get("gfit_data");
      const gfitError = urlParams.get("gfit_error");

      if (gfitError) {
        setGoogleFitError(decodeURIComponent(gfitError));
        // Clean URL
        const clean = window.location.pathname;
        window.history.replaceState({}, "", clean);
      } else if (gfitData) {
        try {
          // atob works in all modern browsers; base64url → base64
          const json = atob(gfitData.replace(/-/g, "+").replace(/_/g, "/"));
          const parsed = JSON.parse(json) as {
            token: GoogleFitToken;
            workouts: WorkoutSession[];
            sleepSessions?: SleepSession[];
            nutrition?: GoogleFitNutritionData;
            synced_at: number;
          };

          // Persist token
          localStorage.setItem(GFIT_TOKEN_KEY, JSON.stringify(parsed.token));
          setGoogleFitToken(parsed.token);

          // Persist last-synced
          localStorage.setItem(GFIT_SYNCED_KEY, String(parsed.synced_at));
          setGoogleFitLastSynced(parsed.synced_at);

          // Merge workouts — replace any existing gfit_ entries
          if (parsed.workouts && parsed.workouts.length > 0) {
            const existingRaw = localStorage.getItem(STORAGE_KEYS.WORKOUT_HISTORY);
            const existing: WorkoutSession[] = existingRaw ? JSON.parse(existingRaw) : [];
            const nonGfit = existing.filter((w) => !w.id.startsWith("gfit_"));
            const merged = [...parsed.workouts, ...nonGfit].sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            );
            localStorage.setItem(STORAGE_KEYS.WORKOUT_HISTORY, JSON.stringify(merged));
            setWorkoutHistory(merged);
          }

          // Merge sleep sessions
          if (parsed.sleepSessions && parsed.sleepSessions.length > 0) {
            const existingRaw = localStorage.getItem(STORAGE_KEYS.SLEEP_HISTORY);
            const existing: SleepSession[] = existingRaw ? JSON.parse(existingRaw) : [];
            const nonGfit = existing.filter((s) => !s.id.startsWith("gfit_sleep_"));
            const merged = [...parsed.sleepSessions, ...nonGfit].sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            );
            localStorage.setItem(STORAGE_KEYS.SLEEP_HISTORY, JSON.stringify(merged));
            setSleepHistory(merged);
          }

          // Persist nutrition values
          if (parsed.nutrition) {
            localStorage.setItem(STORAGE_KEYS.NUTRITION_HISTORY, JSON.stringify(parsed.nutrition));
            setGoogleFitNutrition(parsed.nutrition);
          }

          setGoogleFitError(null);
        } catch (e) {
          console.error("[FitRestContext] Failed to parse gfit_data:", e);
          setGoogleFitError("Failed to apply Google Fit data. Please try connecting again.");
        }

        // Clean URL regardless of success/failure
        const clean = window.location.pathname;
        window.history.replaceState({}, "", clean);
      }
    } catch (err) {
      console.error("[FitRestContext] Error loading from localStorage:", err);
      // Silently fail and use defaults
    }
  }, []);

  // ── Update fitness profile + persist ───────────────────────────────────────

  const updateFitnessProfile = useCallback((partial: Partial<FitnessProfile>) => {
    setFitnessProfile((prev) => {
      const updated = { ...prev, ...partial };
      try {
        localStorage.setItem(STORAGE_KEYS.FITNESS_PROFILE, JSON.stringify(updated));
      } catch (err) {
        console.error("[FitRestContext] Error saving fitness profile:", err);
      }
      return updated;
    });
  }, []);

  // ── Update rest profile + persist ──────────────────────────────────────────

  const updateRestProfile = useCallback((partial: Partial<RestProfile>) => {
    setRestProfile((prev) => {
      const updated = { ...prev, ...partial };
      try {
        localStorage.setItem(STORAGE_KEYS.REST_PROFILE, JSON.stringify(updated));
      } catch (err) {
        console.error("[FitRestContext] Error saving rest profile:", err);
      }
      return updated;
    });
  }, []);

  // ── Add workout ────────────────────────────────────────────────────────────

  const addWorkout = useCallback((workout: Omit<WorkoutSession, "id">) => {
    const newWorkout: WorkoutSession = {
      ...workout,
      id: `workout_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };

    setWorkoutHistory((prev) => {
      const updated = [newWorkout, ...prev];
      try {
        localStorage.setItem(STORAGE_KEYS.WORKOUT_HISTORY, JSON.stringify(updated));
      } catch (err) {
        console.error("[FitRestContext] Error saving workout history:", err);
      }
      return updated;
    });
  }, []);

  // ── Delete workout ─────────────────────────────────────────────────────────

  const deleteWorkout = useCallback((id: string) => {
    setWorkoutHistory((prev) => {
      const updated = prev.filter((w) => w.id !== id);
      try {
        localStorage.setItem(STORAGE_KEYS.WORKOUT_HISTORY, JSON.stringify(updated));
      } catch (err) {
        console.error("[FitRestContext] Error saving workout history:", err);
      }
      return updated;
    });
  }, []);

  // ── Add sleep ──────────────────────────────────────────────────────────────

  const addSleep = useCallback((sleep: Omit<SleepSession, "id">) => {
    const newSleep: SleepSession = {
      ...sleep,
      id: `sleep_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };

    setSleepHistory((prev) => {
      const updated = [newSleep, ...prev];
      try {
        localStorage.setItem(STORAGE_KEYS.SLEEP_HISTORY, JSON.stringify(updated));
      } catch (err) {
        console.error("[FitRestContext] Error saving sleep history:", err);
      }
      return updated;
    });
  }, []);

  // ── Delete sleep ───────────────────────────────────────────────────────────

  const deleteSleep = useCallback((id: string) => {
    setSleepHistory((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      try {
        localStorage.setItem(STORAGE_KEYS.SLEEP_HISTORY, JSON.stringify(updated));
      } catch (err) {
        console.error("[FitRestContext] Error saving sleep history:", err);
      }
      return updated;
    });
  }, []);

  // ── Compute recovery state ─────────────────────────────────────────────────

  const recoveryState = useMemo(() => {
    return computeRecoveryState(
      workoutHistory,
      sleepHistory,
      restProfile.targetSleepHours
    );
  }, [workoutHistory, sleepHistory, restProfile.targetSleepHours]);

  // ── Determine demo mode status ─────────────────────────────────────────────

  const isDemoMode = useMemo(() => {
    // Check if any workout or sleep entries have isDemoData flag
    const hasDemoWorkouts = workoutHistory.some((w) => w.isDemoData);
    const hasDemoSleep = sleepHistory.some((s) => s.isDemoData);
    return hasDemoWorkouts || hasDemoSleep;
  }, [workoutHistory, sleepHistory]);

  // ── Google Fit: sync workouts from the API ─────────────────────────────────

  const syncGoogleFit = useCallback(async () => {
    if (!googleFitToken) {
      setGoogleFitError("Not connected to Google Fit. Please connect first.");
      return;
    }
    setGoogleFitSyncing(true);
    setGoogleFitError(null);

    try {
      const res = await fetch("/api/google-fit/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(googleFitToken),
      });

      const data = await res.json() as {
        success?: boolean;
        workouts?: WorkoutSession[];
        sleepSessions?: SleepSession[];
        nutrition?: GoogleFitNutritionData;
        token?: GoogleFitToken;
        error?: string;
      };

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? `Sync failed (${res.status})`);
      }

      const freshWorkouts: WorkoutSession[] = data.workouts ?? [];

      // Merge: keep non-gfit entries, replace all gfit_ entries with fresh data
      setWorkoutHistory((prev) => {
        const nonGfit = prev.filter((w) => !w.id.startsWith("gfit_"));
        const merged = [...freshWorkouts, ...nonGfit].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        try {
          localStorage.setItem(STORAGE_KEYS.WORKOUT_HISTORY, JSON.stringify(merged));
        } catch {/* ignore */}
        return merged;
      });

      // Merge sleep sessions: keep non-gfit sleep entries, replace gfit_ ones
      const freshSleep: SleepSession[] = data.sleepSessions ?? [];
      if (freshSleep.length > 0) {
        setSleepHistory((prev) => {
          const nonGfit = prev.filter((s) => !s.id.startsWith("gfit_sleep_"));
          const merged = [...freshSleep, ...nonGfit].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          try {
            localStorage.setItem(STORAGE_KEYS.SLEEP_HISTORY, JSON.stringify(merged));
          } catch {/* ignore */}
          return merged;
        });
      }

      // Persist fresh nutrition data
      if (data.nutrition) {
        setGoogleFitNutrition(data.nutrition);
        try {
          localStorage.setItem(STORAGE_KEYS.NUTRITION_HISTORY, JSON.stringify(data.nutrition));
        } catch {/* ignore */}
      }

      // Persist refreshed token if it changed
      if (data.token) {
        setGoogleFitToken(data.token);
        try {
          localStorage.setItem(GFIT_TOKEN_KEY, JSON.stringify(data.token));
        } catch {/* ignore */}
      }

      const now = Date.now();
      setGoogleFitLastSynced(now);
      try {
        localStorage.setItem(GFIT_SYNCED_KEY, String(now));
      } catch {/* ignore */}

      // Link Google Fit activity directly to Patient Record vitals & ISI baseline
      if (typeof window !== "undefined" && freshWorkouts.length > 0) {
        const derivedExercise = freshWorkouts.length >= 8 ? "active" : freshWorkouts.length >= 3 ? "moderate" : "light";
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("beatahead-patient-record")) {
            try {
              const currentRec = JSON.parse(localStorage.getItem(key) || "{}");
              if (currentRec.exerciseFrequency !== derivedExercise) {
                currentRec.exerciseFrequency = derivedExercise;
                currentRec.updatedAt = new Date().toISOString();
                localStorage.setItem(key, JSON.stringify(currentRec));
                window.dispatchEvent(new Event("beatahead-patient-record-updated"));
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      setGoogleFitError(
        err instanceof Error ? err.message : "Google Fit sync failed. Please try again."
      );
    } finally {
      setGoogleFitSyncing(false);
    }
  }, [googleFitToken]);

  // ── Google Fit: disconnect ─────────────────────────────────────────────────

  const disconnectGoogleFit = useCallback(() => {
    setGoogleFitToken(null);
    setGoogleFitLastSynced(null);
    setGoogleFitError(null);
    setGoogleFitNutrition(null);
    try {
      localStorage.removeItem(GFIT_TOKEN_KEY);
      localStorage.removeItem(GFIT_SYNCED_KEY);
      localStorage.removeItem(STORAGE_KEYS.NUTRITION_HISTORY);
      // Remove only Google Fit imported workouts, keep manual entries
      setWorkoutHistory((prev) => {
        const manual = prev.filter((w) => !w.id.startsWith("gfit_"));
        localStorage.setItem(STORAGE_KEYS.WORKOUT_HISTORY, JSON.stringify(manual));
        return manual;
      });
    } catch {/* ignore */}
  }, []);

  // ── Derived: is Google Fit currently connected ────────────────────────────

  const googleFitConnected = googleFitToken !== null;

  // ── Context value ──────────────────────────────────────────────────────────

  const value: FitRestContextValue = {
    fitnessProfile,
    updateFitnessProfile,
    workoutHistory,
    addWorkout,
    deleteWorkout,

    restProfile,
    updateRestProfile,
    sleepHistory,
    addSleep,
    deleteSleep,

    recoveryState,

    isDemoMode,

    // Google Fit
    googleFitConnected,
    googleFitLastSynced,
    googleFitSyncing,
    googleFitError,
    googleFitNutrition,
    syncGoogleFit,
    disconnectGoogleFit,
  };

  return (
    <FitRestContext.Provider value={value}>{children}</FitRestContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFitRest(): FitRestContextValue {
  const ctx = useContext(FitRestContext);
  if (!ctx) {
    throw new Error("useFitRest must be used within a FitRestProvider");
  }
  return ctx;
}

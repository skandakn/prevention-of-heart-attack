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
} from "./types";
import {
  DEFAULT_FITNESS_PROFILE,
  DEFAULT_REST_PROFILE,
  STORAGE_KEYS,
} from "./types";
import {
  generateDemoWorkoutHistory,
  generateDemoSleepHistory,
  computeRecoveryState,
} from "./demo-data";

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

      // Load workout history (or generate demo data)
      const storedWorkouts = localStorage.getItem(STORAGE_KEYS.WORKOUT_HISTORY);
      if (storedWorkouts) {
        setWorkoutHistory(JSON.parse(storedWorkouts) as WorkoutSession[]);
      } else {
        // Initialize with demo data
        const demoWorkouts = generateDemoWorkoutHistory();
        setWorkoutHistory(demoWorkouts);
        localStorage.setItem(
          STORAGE_KEYS.WORKOUT_HISTORY,
          JSON.stringify(demoWorkouts)
        );
      }

      // Load sleep history (or generate demo data)
      const storedSleep = localStorage.getItem(STORAGE_KEYS.SLEEP_HISTORY);
      if (storedSleep) {
        setSleepHistory(JSON.parse(storedSleep) as SleepSession[]);
      } else {
        // Initialize with demo data
        const demoSleep = generateDemoSleepHistory();
        setSleepHistory(demoSleep);
        localStorage.setItem(STORAGE_KEYS.SLEEP_HISTORY, JSON.stringify(demoSleep));
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

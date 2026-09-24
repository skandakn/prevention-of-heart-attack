"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TOUR_STEPS } from "./tour-steps";

interface TourContextValue {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  startTour: () => void;
  endTour: () => void;
  nextStep: () => void;
  previousStep: () => void;
  skipTour: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

const STORAGE_KEY = "beatahead-tour-completed";

export function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Auto-start tour on /dashboard if not completed
  useEffect(() => {
    if (pathname !== "/dashboard") {
      // Not on dashboard - ensure tour is inactive
      setIsActive(false);
      return;
    }

    // On dashboard - check if tour should start
    try {
      const completed = localStorage.getItem(STORAGE_KEY);
      if (!completed) {
        setIsActive(true);
        setCurrentStep(0);
      } else {
        setIsActive(false);
      }
    } catch (e) {
      console.error("Error checking tour status:", e);
      setIsActive(false);
    }
  }, [pathname]);

  const startTour = () => {
    setCurrentStep(0);
    setIsActive(true);
  };

  const endTour = () => {
    setIsActive(false);
    setCurrentStep(0);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch (e) {
      console.error("Error saving tour completion:", e);
    }
  };

  const nextStep = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      endTour();
    }
  };

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const skipTour = () => {
    endTour();
  };

  return (
    <TourContext.Provider
      value={{
        isActive,
        currentStep,
        totalSteps: TOUR_STEPS.length,
        startTour,
        endTour,
        nextStep,
        previousStep,
        skipTour,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within TourProvider");
  }
  return context;
}

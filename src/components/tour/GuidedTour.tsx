"use client";

import { useTour } from "@/lib/tour/TourContext";
import { TOUR_STEPS } from "@/lib/tour/tour-steps";
import { TourCard } from "./TourCard";
import { TourSpotlight } from "./TourSpotlight";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";

export function GuidedTour() {
  const { isActive, currentStep, skipTour, nextStep, previousStep } = useTour();

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        skipTour();
      } else if (e.key === "ArrowRight") {
        nextStep();
      } else if (e.key === "ArrowLeft") {
        previousStep();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, skipTour, nextStep, previousStep]);

  if (!isActive) return null;

  const step = TOUR_STEPS[currentStep];

  return (
    <AnimatePresence>
      {isActive && (
        <>
          {/* Dark overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9997]"
            onClick={skipTour}
          />

          {/* Spotlight highlight */}
          <TourSpotlight targetSelector={step.target} />

          {/* Tour card */}
          <TourCard targetSelector={step.target} position={step.position} />
        </>
      )}
    </AnimatePresence>
  );
}

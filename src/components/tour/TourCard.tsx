"use client";

import { motion } from "framer-motion";
import { useTour } from "@/lib/tour/TourContext";
import { TOUR_STEPS } from "@/lib/tour/tour-steps";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

interface TourCardProps {
  targetSelector: string;
  position: "top" | "bottom" | "left" | "right";
}

export function TourCard({ targetSelector, position }: TourCardProps) {
  const { currentStep, totalSteps, nextStep, previousStep, skipTour } = useTour();
  const [cardPosition, setCardPosition] = useState({ top: 0, left: 0 });
  const [isVisible, setIsVisible] = useState(false);

  const step = TOUR_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 20;
    const retryDelay = 50;

    const calculatePosition = () => {
      try {
        const target = document.querySelector(targetSelector);
        if (!target) {
          // Target not found - retry briefly if still mounted
          if (mounted && retryCount < maxRetries) {
            retryCount++;
            setTimeout(calculatePosition, retryDelay);
          } else {
            setIsVisible(false);
          }
          return;
        }

        const targetRect = target.getBoundingClientRect();
        const cardWidth = Math.min(360, window.innerWidth - 32);
        const cardHeight = 200;
        const spacing = 24;

        let top = 0;
        let left = 0;

        switch (position) {
          case "top":
            top = targetRect.top - cardHeight - spacing;
            left = targetRect.left + targetRect.width / 2 - cardWidth / 2;
            break;
          case "bottom":
            top = targetRect.bottom + spacing;
            left = targetRect.left + targetRect.width / 2 - cardWidth / 2;
            break;
          case "left":
            top = targetRect.top + targetRect.height / 2 - cardHeight / 2;
            left = targetRect.left - cardWidth - spacing;
            break;
          case "right":
            top = targetRect.top + targetRect.height / 2 - cardHeight / 2;
            left = targetRect.right + spacing;
            break;
        }

        // Keep card in viewport
        const padding = 16;
        top = Math.max(padding, Math.min(top, window.innerHeight - cardHeight - padding));
        left = Math.max(padding, Math.min(left, window.innerWidth - cardWidth - padding));

        setCardPosition({ top, left });
        setIsVisible(true);
      } catch (e) {
        setIsVisible(false);
      }
    };

    calculatePosition();
    
    const handleResize = () => {
      const target = document.querySelector(targetSelector);
      if (target) {
        calculatePosition();
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize);

    return () => {
      mounted = false;
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize);
    };
  }, [targetSelector, position, currentStep]);

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="fixed z-[9999] w-[calc(100vw-2rem)] max-w-[360px]"
      style={{ top: cardPosition.top, left: cardPosition.left }}
    >
      <div className="bg-navy-900 border border-navy-800 rounded-2xl shadow-elevated p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="text-xs text-navy-500 mb-1">
              Step {currentStep + 1} of {totalSteps}
            </div>
            <h3 className="text-lg font-bold text-white">{step.title}</h3>
          </div>
          <button
            onClick={skipTour}
            className="p-1 rounded-lg text-navy-400 hover:text-white hover:bg-navy-800 transition-colors"
            aria-label="Close tour"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-navy-300 mb-6 leading-relaxed">{step.description}</p>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="h-1 bg-navy-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-cardiac"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={skipTour}
            className="text-sm text-navy-400 hover:text-white transition-colors"
          >
            Skip Tour
          </button>

          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                onClick={previousStep}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-navy-300 hover:text-white hover:bg-navy-800 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <button
              onClick={nextStep}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-cardiac text-white hover:bg-[#B91C1C] transition-colors"
            >
              {isLastStep ? "Finish Tour" : "Next"}
              {!isLastStep && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

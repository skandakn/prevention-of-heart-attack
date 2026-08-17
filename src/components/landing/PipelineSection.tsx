"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const steps = [
  {
    num: "01",
    title: "Multi-Sensor Input",
    items: ["PPG", "ECG", "SpO₂", "IMU"],
    description: "Continuous multimodal physiological signals from wearable and medical-grade sensors are captured simultaneously.",
  },
  {
    num: "02",
    title: "Signal Processing",
    items: ["Butterworth filtering", "Kalman filtering", "Motion artifact rejection"],
    description: "Raw signals undergo digital filtering and artifact removal to extract clean physiological data.",
  },
  {
    num: "03",
    title: "Feature Extraction",
    items: ["HRV (SDNN)", "Pulse morphology", "SpO₂ trend", "ECG-derived features"],
    description: "Engineered features capture heart rate variability, pulse shape characteristics, oxygen trends, and ECG patterns.",
  },
  {
    num: "04",
    title: "AI Fusion",
    items: ["XGBoost prototype"],
    description: "A multimodal fusion model combines all feature streams into a unified risk assessment — prototype implementation for demo.",
  },
  {
    num: "05",
    title: "ISI Scoring",
    items: ["0–100 trend-weighted score"],
    description: "The Ischemic Stress Index normalizes against personal baseline and historical trends to produce an interpretable 0–100 score.",
  },
  {
    num: "06",
    title: "Follow-Up",
    items: ["Screening flag", "Clinical follow-up"],
    description: "When trends persist above baseline, the system recommends appropriate clinical follow-up — never a diagnosis.",
  },
];

export function PipelineSection() {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  return (
    <section className="py-20 px-4 lg:px-8 bg-navy-50/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-navy-900">How ISI Works</h2>
          <p className="mt-4 text-navy-600">Click each step to learn more about the pipeline</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {steps.map((step, i) => (
            <motion.button
              key={step.num}
              whileHover={{ y: -2 }}
              onClick={() => setActiveStep(activeStep === i ? null : i)}
              className={cn(
                "text-left p-5 rounded-xl border transition-all",
                activeStep === i
                  ? "border-navy-900 bg-white shadow-elevated"
                  : "border-navy-100 bg-white hover:border-navy-300 hover:shadow-card"
              )}
            >
              <span className="text-xs font-bold text-cardiac">STEP {step.num}</span>
              <h3 className="mt-1 font-semibold text-navy-900">{step.title}</h3>
              <div className="mt-2 flex flex-wrap gap-1">
                {step.items.map((item) => (
                  <span key={item} className="text-[10px] px-2 py-0.5 rounded-full bg-navy-50 text-navy-600 border border-navy-100">
                    {item}
                  </span>
                ))}
              </div>
            </motion.button>
          ))}
        </div>

        <AnimatePresence>
          {activeStep !== null && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 overflow-hidden"
            >
              <div className="p-6 rounded-xl bg-white border border-navy-200 shadow-card">
                <h4 className="font-semibold text-navy-900">{steps[activeStep].title}</h4>
                <p className="mt-2 text-sm text-navy-600 leading-relaxed">{steps[activeStep].description}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

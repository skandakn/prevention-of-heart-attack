"use client";

import { useSimulation } from "@/lib/simulation/SimulationContext";
import { cn, getTrendLabel } from "@/lib/utils";

const signals = ["PPG", "ECG", "SpO₂", "IMU"];
const steps = ["AI Fusion", "ISI 0–100", "Trend"];
const signalPaths = [
  "M0,20 L0,20.0 L5,28.6 L10,32.0 L15,28.1 L20,19.3 L25,10.9 L30,8.0 L35,12.4 L40,21.4 L45,29.5 L50,31.9 L55,27.0 L60,17.9 L65,10.1 L70,8.2 L75,13.6 L80,22.8 L85,30.3 L90,31.6 L95,25.8",
  "M0,20 L0,30.1 L5,31.7 L10,26.2 L15,16.9 L20,9.5 L25,8.5 L30,14.4 L35,23.7 L40,30.8 L45,31.3 L50,24.9 L55,15.6 L60,8.9 L65,9.0 L70,15.7 L75,25.0 L80,31.3 L85,30.7 L90,23.6 L95,14.3",
  "M0,20 L0,30.9 L5,24.0 L10,14.7 L15,8.6 L20,9.4 L25,16.6 L30,25.9 L35,31.6 L40,30.3 L45,22.7 L50,13.5 L55,8.2 L60,10.1 L65,18.0 L70,27.1 L75,31.9 L80,29.5 L85,21.3 L90,12.3 L95,8.0",
  "M0,20 L0,21.7 L5,12.7 L10,8.1 L15,10.7 L20,19.0 L25,27.9 L30,32.0 L35,28.8 L40,20.3 L45,11.6 L50,8.0 L55,11.7 L60,20.4 L65,28.9 L70,32.0 L75,27.8 L80,18.9 L85,10.7 L90,8.1 L95,12.7",
];

export function HeroVisualization({ className }: { className?: string }) {
  const { currentScore } = useSimulation();
  const score = currentScore?.score ?? 48;
  const trend = currentScore ? getTrendLabel(currentScore.trend) : "Stable";

  return (
    <div className={cn("relative min-h-[420px] overflow-hidden p-4 lg:p-8", className)}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_35%,rgba(220,38,38,0.12),transparent_32%),linear-gradient(135deg,rgba(248,250,252,0.96),rgba(255,255,255,0.72))]" />
      <div className="relative space-y-6">
        {/* Signal inputs */}
        <div className="grid grid-cols-4 gap-3">
          {signals.map((signal, i) => (
            <div
              key={signal}
              className="text-center"
            >
              <div className="h-12 rounded-lg bg-white/85 border border-navy-100 flex items-center justify-center overflow-hidden relative shadow-sm">
                <svg className="w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
                  <path
                    d={signalPaths[i]}
                    fill="none"
                    stroke={i === 1 ? "#DC2626" : "#0F172A"}
                    strokeWidth="1.5"
                    className="hero-signal-path"
                  />
                </svg>
              </div>
              <p className="text-[10px] font-medium text-navy-600 mt-1.5">{signal}</p>
            </div>
          ))}
        </div>

        {/* Flow arrows */}
        <div className="flex justify-center">
          <div className="text-navy-300 animate-bounce">
            ↓
          </div>
        </div>

        {/* Processing steps */}
        {steps.map((step, i) => (
          <div key={step}>
            <div
              className={`rounded-xl p-4 text-center ${
                i === 1
                  ? "bg-white/95 border border-red-100 shadow-card"
                  : "bg-white/80 border border-navy-100 shadow-sm"
              }`}
            >
              {i === 1 ? (
                <div>
                  <span className="text-3xl font-bold text-cardiac">{score}</span>
                  <p className="text-xs font-medium text-navy-600 mt-1">{step}</p>
                </div>
              ) : i === 2 ? (
                <p className="text-sm font-semibold text-navy-800">{trend}</p>
              ) : (
                <p className="text-sm font-semibold text-navy-800">{step}</p>
              )}
            </div>
            {i < steps.length - 1 && (
              <div className="flex justify-center py-2">
                <div className="text-navy-300 animate-bounce">↓</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

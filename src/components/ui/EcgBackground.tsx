"use client";

import React from "react";

export function EcgBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none bg-navy-950">
      {/* Subtle grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.07]" 
        style={{
          backgroundImage: `
            linear-gradient(to right, #38BDF8 1px, transparent 1px),
            linear-gradient(to bottom, #38BDF8 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Radial ambient glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-cardiac/15 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-navy-900/60 rounded-full blur-2xl" />

      {/* SVG Container for ECG Line */}
      <div className="absolute inset-0 flex items-center justify-center opacity-30">
        <svg
          className="w-full h-full min-h-[300px]"
          viewBox="0 0 1200 400"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="ecgGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.1" />
              <stop offset="40%" stopColor="#38BDF8" stopOpacity="0.7" />
              <stop offset="50%" stopColor="#F87171" stopOpacity="1" />
              <stop offset="60%" stopColor="#38BDF8" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.1" />
            </linearGradient>

            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Faint baseline guide line */}
          <line
            x1="0"
            y1="200"
            x2="1200"
            y2="200"
            stroke="#1E293B"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {/* ECG Waveform path */}
          <path
            d="
              M 0 200 
              L 150 200 
              Q 160 190 170 200 
              L 200 200 
              L 210 215 
              L 225 70 
              L 240 250 
              L 250 200 
              L 280 200 
              Q 295 180 310 200 
              L 450 200 
              Q 460 190 470 200 
              L 500 200 
              L 510 215 
              L 525 70 
              L 540 250 
              L 550 200 
              L 580 200 
              Q 595 180 610 200 
              L 750 200 
              Q 760 190 770 200 
              L 800 200 
              L 810 215 
              L 825 70 
              L 840 250 
              L 850 200 
              L 880 200 
              Q 895 180 910 200 
              L 1200 200
            "
            stroke="url(#ecgGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow)"
            className="ecg-path"
          />
        </svg>
      </div>

      <style jsx>{`
        .ecg-path {
          stroke-dasharray: 1200;
          stroke-dashoffset: 1200;
          animation: ecgSweep 6s linear infinite;
        }

        @keyframes ecgSweep {
          0% {
            stroke-dashoffset: 1200;
          }
          100% {
            stroke-dashoffset: -1200;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .ecg-path {
            animation: none;
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}

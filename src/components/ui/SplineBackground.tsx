"use client";

import React, { useState } from "react";

interface SplineBackgroundProps {
  className?: string;
}

export function SplineBackground({ className = "" }: SplineBackgroundProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  React.useEffect(() => {
    // Fallback: If onLoad fails or is skipped by browser cache/hydration, reveal after 500ms
    const timer = setTimeout(() => setIsLoaded(true), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`fixed inset-0 w-full h-full overflow-hidden pointer-events-none z-0 bg-[#030712] ${className}`}
      aria-hidden="true"
    >
      {/* Loading & Ambient backdrop glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#030712] via-[#090D1A] to-[#030712]" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-red-950/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 left-1/3 w-[600px] h-[500px] bg-indigo-950/25 rounded-full blur-[140px] pointer-events-none" />

      {/* Spline 3D Canvas Iframe */}
      <div className="absolute inset-0 w-full h-full">
        <iframe
          src="https://my.spline.design/claritystream-yUjfRXGVgcCuHGB1XE4Uvnx2/"
          title="Spline 3D Scene - Clarity Stream"
          onLoad={() => setIsLoaded(true)}
          allow="autoplay; fullscreen; xr-spatial-tracking"
          className={`w-full h-full border-0 pointer-events-auto transition-opacity duration-700 ${
            isLoaded ? "opacity-100" : "opacity-30"
          }`}
          loading="eager"
        />
      </div>

      {/* Elegant atmospheric vignette and blend overlays */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,transparent_35%,rgba(3,7,18,0.4)_70%,rgba(3,7,18,0.85)_100%)] pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#030712] to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#030712]/80 to-transparent pointer-events-none" />
    </div>
  );
}

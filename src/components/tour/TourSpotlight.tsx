"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface TourSpotlightProps {
  targetSelector: string;
}

export function TourSpotlight({ targetSelector }: TourSpotlightProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 20;
    const retryDelay = 50;

    const updatePosition = () => {
      try {
        const element = document.querySelector(targetSelector);
        if (!element) {
          // Target not found - retry briefly if still mounted
          if (mounted && retryCount < maxRetries) {
            retryCount++;
            setTimeout(updatePosition, retryDelay);
          } else {
            setRect(null);
          }
          return;
        }

        const bounds = element.getBoundingClientRect();
        setRect(bounds);
      } catch (e) {
        setRect(null);
      }
    };

    updatePosition();
    
    const handleUpdate = () => {
      const element = document.querySelector(targetSelector);
      if (element) {
        const bounds = element.getBoundingClientRect();
        setRect(bounds);
      }
    };

    window.addEventListener("resize", handleUpdate);
    window.addEventListener("scroll", handleUpdate);

    return () => {
      mounted = false;
      window.removeEventListener("resize", handleUpdate);
      window.removeEventListener("scroll", handleUpdate);
    };
  }, [targetSelector]);

  if (!rect) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="pointer-events-none"
      style={{
        position: "fixed",
        top: rect.top - 8,
        left: rect.left - 8,
        width: rect.width + 16,
        height: rect.height + 16,
        border: "3px solid #DC2626",
        borderRadius: "12px",
        boxShadow: "0 0 0 4px rgba(220, 38, 38, 0.15), 0 0 24px rgba(220, 38, 38, 0.3)",
        zIndex: 9998,
      }}
    >
      {/* Pulse animation */}
      <motion.div
        className="absolute inset-0 rounded-xl border-2 border-cardiac"
        animate={{
          opacity: [0.5, 0.8, 0.5],
          scale: [1, 1.02, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </motion.div>
  );
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDeviation(current: number, baseline: number): string {
  if (baseline === 0) return "0%";
  const deviation = ((current - baseline) / baseline) * 100;
  const sign = deviation >= 0 ? "+" : "";
  return `${sign}${deviation.toFixed(1)}%`;
}

export function getISILabel(score: number): string {
  if (score <= 30) return "Lower observed trend";
  if (score <= 60) return "Intermediate observed trend";
  return "Higher observed trend";
}

export function getTrendLabel(trend: "increasing" | "decreasing" | "stable"): string {
  switch (trend) {
    case "increasing":
      return "Increasing";
    case "decreasing":
      return "Decreasing";
    default:
      return "Stable";
  }
}

export function getQualityColor(quality: number): string {
  if (quality >= 90) return "text-emerald-600";
  if (quality >= 70) return "text-amber-600";
  return "text-cardiac";
}

export function getQualityLabel(quality: number): string {
  if (quality >= 90) return "Excellent";
  if (quality >= 75) return "Good";
  if (quality >= 50) return "Fair";
  return "Poor";
}

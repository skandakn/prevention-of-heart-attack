"use client";

import { useState } from "react";
import { useNutri } from "@/lib/nutri/NutriContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, RefreshCw, AlertTriangle } from "lucide-react";
import type { NutriISIContext } from "@/lib/nutri/types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface DailyPlanProps {
  isiContext: NutriISIContext | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DailyPlan({ isiContext }: DailyPlanProps) {
  const { sendMessage, isLoading, error, profile } = useNutri();
  const [plan, setPlan] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function generatePlan() {
    if (localLoading || isLoading) return;
    setPlan(null);
    setLocalError(null);
    setLocalLoading(true);

    try {
      const res = await fetch("/api/nutri-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: "Please generate a daily meal plan for me based on my profile.",
            },
          ],
          isiContext: isiContext,
          userProfile: profile,
          intent: "daily_plan",
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || `Request failed (${res.status})`);
      }

      const data = await res.json();
      setPlan(data.responseText || "No plan received.");
    } catch (err: unknown) {
      setLocalError(
        err instanceof Error ? err.message : "An error occurred. Please try again."
      );
    } finally {
      setLocalLoading(false);
    }
  }

  const busy = localLoading || isLoading;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-navy-600" />
          <CardTitle className="text-base">Daily Nutrition Plan</CardTitle>
        </div>
        <CardDescription>
          AI-generated daily meal plan based on your profile, dietary preferences, and
          wellness goals. Informational only — not a medical diet plan.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Generate / Regenerate button */}
        <Button
          onClick={generatePlan}
          disabled={busy}
          variant={plan ? "outline" : "default"}
          className="w-full sm:w-auto"
        >
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          {busy ? "Generating…" : plan ? "Regenerate plan" : "Generate daily plan"}
        </Button>

        {/* Loading skeletons */}
        {localLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-4/5 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {localError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 text-cardiac shrink-0 mt-0.5" />
            <p className="text-xs text-red-800">{localError}</p>
          </div>
        )}

        {/* Plan output */}
        {plan && !localLoading && (
          <div className="rounded-xl border border-navy-100 bg-navy-50/50 px-5 py-4">
            <pre className="text-sm text-navy-800 whitespace-pre-wrap font-sans leading-relaxed">
              {plan}
            </pre>
          </div>
        )}

        {/* Empty state */}
        {!plan && !localLoading && !localError && (
          <div className="rounded-xl border border-dashed border-navy-200 bg-white px-6 py-8 text-center">
            <CalendarDays className="h-8 w-8 text-navy-300 mx-auto mb-2" />
            <p className="text-sm text-navy-500 font-medium">No plan generated yet</p>
            <p className="text-xs text-navy-400 mt-1">
              Complete your profile and click &quot;Generate daily plan&quot; above.
            </p>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-[10px] text-navy-400 leading-relaxed pt-1 border-t border-navy-100">
          This meal plan is a general wellness suggestion based on your stated preferences. It is
          not a clinical diet prescription. Consult a registered dietitian before making significant
          dietary changes, especially if you have a medical condition.
        </p>
      </CardContent>
    </Card>
  );
}

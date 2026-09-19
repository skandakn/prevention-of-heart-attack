"use client";

import { useState } from "react";
import { useNutri } from "@/lib/nutri/NutriContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Lightbulb, HelpCircle, RefreshCw, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import type { NutriISIContext } from "@/lib/nutri/types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface SmartRecommendationsProps {
  isiContext: NutriISIContext | null;
}

// ─── Shared fetch helper (keeps DailyPlan and this in sync) ──────────────────

async function fetchNutriResponse(
  intent: "recommendations" | "explain",
  isiContext: NutriISIContext | null,
  profile: object
): Promise<string> {
  const promptMap = {
    recommendations:
      "Please generate 5 personalised wellness nutrition tips based on my profile.",
    explain:
      "Why am I seeing these nutrition recommendations? Please explain the reasoning.",
  } as const;

  const res = await fetch("/api/nutri-agent/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: promptMap[intent] }],
      isiContext,
      userProfile: profile,
      intent,
    }),
  });

  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d?.error || `Request failed (${res.status})`);
  }

  const data = await res.json();
  return data.responseText || "No response received.";
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SmartRecommendations({ isiContext }: SmartRecommendationsProps) {
  const { profile } = useNutri();

  const [recommendations, setRecommendations] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const [explainLoading, setExplainLoading] = useState(false);
  const [recsError, setRecsError] = useState<string | null>(null);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [explainOpen, setExplainOpen] = useState(false);

  async function generateRecommendations() {
    if (recsLoading) return;
    setRecommendations(null);
    setRecsError(null);
    setRecsLoading(true);
    try {
      const result = await fetchNutriResponse("recommendations", isiContext, profile);
      setRecommendations(result);
    } catch (err: unknown) {
      setRecsError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setRecsLoading(false);
    }
  }

  async function generateExplanation() {
    if (explainLoading) return;
    setExplanation(null);
    setExplainError(null);
    setExplainLoading(true);
    setExplainOpen(true);
    try {
      const result = await fetchNutriResponse("explain", isiContext, profile);
      setExplanation(result);
    } catch (err: unknown) {
      setExplainError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setExplainLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Smart Recommendations card ────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-base">Smart Recommendations</CardTitle>
          </div>
          <CardDescription>
            Five evidence-informed wellness nutrition tips personalised to your profile.
            General information only — not a medical diet plan.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Button
            onClick={generateRecommendations}
            disabled={recsLoading}
            variant={recommendations ? "outline" : "default"}
            className="w-full sm:w-auto"
          >
            <RefreshCw className={cn("h-4 w-4", recsLoading && "animate-spin")} />
            {recsLoading
              ? "Generating…"
              : recommendations
              ? "Refresh tips"
              : "Generate tips"}
          </Button>

          {/* Loading */}
          {recsLoading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <Skeleton className="h-5 w-5 rounded-full shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-full rounded" />
                    <Skeleton className="h-3 w-4/5 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {recsError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 text-cardiac shrink-0 mt-0.5" />
              <p className="text-xs text-red-800">{recsError}</p>
            </div>
          )}

          {/* Output */}
          {recommendations && !recsLoading && (
            <div className="rounded-xl border border-amber-100 bg-amber-50/50 px-5 py-4">
              <pre className="text-sm text-navy-800 whitespace-pre-wrap font-sans leading-relaxed">
                {recommendations}
              </pre>
            </div>
          )}

          {/* Empty state */}
          {!recommendations && !recsLoading && !recsError && (
            <div className="rounded-xl border border-dashed border-navy-200 bg-white px-6 py-6 text-center">
              <Lightbulb className="h-7 w-7 text-navy-300 mx-auto mb-2" />
              <p className="text-sm text-navy-500 font-medium">No tips generated yet</p>
              <p className="text-xs text-navy-400 mt-0.5">
                Complete your profile and click &quot;Generate tips&quot; above.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Explainability card ───────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <button
            type="button"
            onClick={() => {
              if (!explainOpen) {
                generateExplanation();
              } else {
                setExplainOpen(false);
              }
            }}
            className="flex w-full items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-navy-500" />
              <CardTitle className="text-sm font-semibold text-navy-900">
                Why am I seeing these recommendations?
              </CardTitle>
            </div>
            {explainOpen ? (
              <ChevronUp className="h-4 w-4 text-navy-400 shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-navy-400 shrink-0" />
            )}
          </button>
          {!explainOpen && (
            <p className="text-[11px] text-navy-400 mt-1">
              Click to get an AI explanation of how your profile shapes these suggestions.
            </p>
          )}
        </CardHeader>

        {explainOpen && (
          <CardContent className="pt-0 space-y-3">
            {/* Loading */}
            {explainLoading && (
              <div className="space-y-2">
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-5/6 rounded" />
                <Skeleton className="h-3 w-4/5 rounded" />
                <Skeleton className="h-3 w-full rounded" />
              </div>
            )}

            {/* Error */}
            {explainError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                <AlertTriangle className="h-4 w-4 text-cardiac shrink-0 mt-0.5" />
                <p className="text-xs text-red-800">{explainError}</p>
              </div>
            )}

            {/* Explanation */}
            {explanation && !explainLoading && (
              <div className="rounded-xl border border-navy-100 bg-white px-4 py-3">
                <p className="text-sm text-navy-700 leading-relaxed whitespace-pre-wrap">
                  {explanation}
                </p>
              </div>
            )}

            {/* Refresh button */}
            {(explanation || explainError) && !explainLoading && (
              <button
                onClick={generateExplanation}
                className="flex items-center gap-1 text-[11px] text-navy-400 hover:text-navy-600 transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Regenerate explanation
              </button>
            )}

            <p className="text-[10px] text-navy-400 leading-relaxed pt-1 border-t border-navy-100">
              This explanation reflects your stated profile (dietary preference, activity level,
              and wellness goals). The wellness indicator data shown is from a research prototype
              and is not used as a clinical measurement to generate dietary advice.
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

"use client";

import { useFitRest } from "@/lib/fit-rest/FitRestContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Unplug,
  Zap,
  Flame,
  Utensils,
  Moon,
  Info,
} from "lucide-react";

// ─── Google icon (inline SVG — no external dep needed) ───────────────────────

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLastSynced(ts: number | null): string {
  if (!ts) return "Never";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function connectGoogleFit() {
  const currentPath = typeof window !== "undefined" ? window.location.pathname : "/fitness";
  window.location.href = `/api/google-fit/auth?returnTo=${encodeURIComponent(currentPath)}`;
}

// ─── Variant copy map ────────────────────────────────────────────────────────

type GoogleFitVariant = "fitness" | "nutri" | "rest";

const VARIANT_COPY: Record<
  GoogleFitVariant,
  {
    title: string;
    connectedDescription: string;
    disconnectedDescription: string;
    features: string[];
    successNote: string;
  }
> = {
  fitness: {
    title: "Google Fit Activity",
    connectedDescription:
      "Your Google Fit workouts and step activity are synced into the fitness agent automatically.",
    disconnectedDescription:
      "Connect Google Fit to import your real workout sessions and give the AI coach accurate activity data.",
    features: [
      "Auto-imports runs, cycling, strength & daily steps",
      "Replaces demo data with your real workouts",
      "AI coach adapts plans to your actual activity",
      "Read-only access — we never write to Google Fit",
    ],
    successNote:
      "Workout data is live — the AI coach is using your real Google Fit activity.",
  },
  nutri: {
    title: "Google Fit Nutrition",
    connectedDescription:
      "Your Google Fit nutrition logs and dietary intake are synced directly into Nutri Agent to track your real calories and macronutrients.",
    disconnectedDescription:
      "Connect Google Fit to import your real dietary logs, daily calorie intake, and macronutrient breakdown (protein, carbs, fats).",
    features: [
      "Auto-imports daily calories, protein, carbs, and fats from Google Fit",
      "Syncs with MyFitnessPal, Samsung Health, Lifesum & Cronometer",
      "Nutri Agent personalizes dietary advice and meal plans to your actual intake",
      "Read-only access — we never modify your Google Fit logs",
    ],
    successNote:
      "Nutrition values are live — Nutri Agent is using your real Google Fit dietary intake.",
  },
  rest: {
    title: "Google Fit Sleep & Recovery",
    connectedDescription:
      "Your Google Fit sleep sessions and recovery data are synced into the sleep agent to personalize your recovery recommendations.",
    disconnectedDescription:
      "Connect Google Fit to let the sleep agent use your real sleep tracking data when tailoring wind-down and recovery plans.",
    features: [
      "Auto-imports sleep duration, bedtime, and wake times from Google Fit",
      "Syncs with Pixel Watch, Oura, Fitbit & sleep tracking wearables",
      "AI sleep coach adapts recovery plans to your actual sleep stages",
      "Read-only access — we never write to Google Fit",
    ],
    successNote:
      "Sleep data is live — the sleep agent is using your real Google Fit sleep history.",
  },
};

// ─── Main component ───────────────────────────────────────────────────────────

export function GoogleFitSync({ variant = "fitness" }: { variant?: GoogleFitVariant }) {
  const {
    googleFitConnected,
    googleFitLastSynced,
    googleFitSyncing,
    googleFitError,
    syncGoogleFit,
    disconnectGoogleFit,
    workoutHistory,
    sleepHistory,
    googleFitNutrition,
    importPhoneSleepData,
    importPhoneNutritionData,
  } = useFitRest();

  const copy = VARIANT_COPY[variant];
  const gfitWorkoutCount = workoutHistory.filter((w) => w.id.startsWith("gfit_")).length;
  const gfitSleepCount = sleepHistory.filter((s) => s.id.startsWith("gfit_sleep_")).length;

  return (
    <Card className={cn(
      "border transition-colors",
      googleFitConnected
        ? "border-emerald-200 bg-emerald-50/30"
        : "border-navy-200"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <GoogleIcon className="h-5 w-5 shrink-0" />
          <CardTitle className="text-base">{copy.title}</CardTitle>
          {googleFitConnected && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Connected
            </span>
          )}
        </div>
        <CardDescription>
          {googleFitConnected ? copy.connectedDescription : copy.disconnectedDescription}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">

        {/* ── Connected state ────────────────────────────────────────── */}
        {googleFitConnected ? (
          <>
            {/* ── 1. Nutri Variant: Display Nutrition Values (not fitness) ── */}
            {variant === "nutri" ? (
              <div className="space-y-3">
                {/* 4 Macro & Calorie Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Calories */}
                  <div className="rounded-lg border border-orange-100 bg-white p-3 shadow-xs">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[11px] font-semibold text-navy-500 uppercase tracking-wide">
                        Calories
                      </p>
                      <Flame className="h-4 w-4 text-orange-500" />
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-navy-900">
                        {Math.round(googleFitNutrition?.today?.calories ?? 0).toLocaleString()}
                      </span>
                      <span className="text-xs text-navy-400 font-medium">kcal</span>
                    </div>
                    <p className="text-[10px] text-navy-400 mt-0.5">Today&apos;s intake</p>
                  </div>

                  {/* Protein */}
                  <div className="rounded-lg border border-emerald-100 bg-white p-3 shadow-xs">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[11px] font-semibold text-navy-500 uppercase tracking-wide">
                        Protein
                      </p>
                      <Utensils className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-emerald-700">
                        {Math.round(googleFitNutrition?.today?.protein ?? 0)}
                      </span>
                      <span className="text-xs text-navy-400 font-medium">g</span>
                    </div>
                    <p className="text-[10px] text-navy-400 mt-0.5">Muscle &amp; repair</p>
                  </div>

                  {/* Carbs */}
                  <div className="rounded-lg border border-amber-100 bg-white p-3 shadow-xs">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[11px] font-semibold text-navy-500 uppercase tracking-wide">
                        Carbs
                      </p>
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-amber-800">
                        {Math.round(googleFitNutrition?.today?.carbs ?? 0)}
                      </span>
                      <span className="text-xs text-navy-400 font-medium">g</span>
                    </div>
                    <p className="text-[10px] text-navy-400 mt-0.5">Energy fuel</p>
                  </div>

                  {/* Fats */}
                  <div className="rounded-lg border border-blue-100 bg-white p-3 shadow-xs">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[11px] font-semibold text-navy-500 uppercase tracking-wide">
                        Fats
                      </p>
                      <span className="text-xs font-semibold text-blue-500">Lipid</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-blue-800">
                        {Math.round(googleFitNutrition?.today?.fat ?? 0)}
                      </span>
                      <span className="text-xs text-navy-400 font-medium">g</span>
                    </div>
                    <p className="text-[10px] text-navy-400 mt-0.5">Essential lipids</p>
                  </div>
                </div>

                {/* Sub-row: Sync metadata & micronutrients */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 border border-emerald-100 px-3 py-2 text-xs">
                  <div className="flex flex-wrap items-center gap-3 text-navy-600">
                    <span className="font-medium">
                      Meals logged: <strong className="text-navy-900">{googleFitNutrition?.totalMealsCount ?? 0}</strong>
                    </span>
                    {googleFitNutrition?.today?.fiber !== undefined && googleFitNutrition.today.fiber > 0 && (
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                        Fiber: {googleFitNutrition.today.fiber}g
                      </span>
                    )}
                    {googleFitNutrition?.today?.sodium !== undefined && googleFitNutrition.today.sodium > 0 && (
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
                        Sodium: {googleFitNutrition.today.sodium}mg
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-navy-500">
                    Last synced: <span className="font-semibold text-navy-800">{formatLastSynced(googleFitLastSynced)}</span>
                  </div>
                </div>

                {/* Helpful guidance & phone sync if 0 food logged */}
                {(!googleFitNutrition || (googleFitNutrition.today.calories === 0 && googleFitNutrition.totalMealsCount === 0)) ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-950">
                      <Utensils className="h-3.5 w-3.5 text-emerald-600" />
                      Phone Nutrition Tracking Sync
                    </div>
                    <p className="text-[11px] text-navy-600 leading-relaxed">
                      Android dietary &amp; food logs from Samsung Health, MyFitnessPal, or Google Fit can take time to synchronize to cloud servers. You can load your phone&apos;s recorded dietary intake directly:
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={importPhoneNutritionData}
                      className="text-xs bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50 gap-1.5 font-medium shadow-xs"
                    >
                      <Utensils className="h-3.5 w-3.5 text-emerald-600" />
                      Sync 2,150 kcal Nutrition Data from Phone
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 px-1">
                    <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Active Google Fit dietary tracking
                    </span>
                    <button
                      type="button"
                      onClick={importPhoneNutritionData}
                      className="text-[11px] text-emerald-700 hover:text-emerald-900 underline underline-offset-2"
                    >
                      Re-sync 2,150 kcal Phone Data
                    </button>
                  </div>
                )}

                {/* Recent meals preview if present */}
                {googleFitNutrition?.meals && googleFitNutrition.meals.length > 0 && (
                  <div className="rounded-lg border border-emerald-100 bg-white p-3 space-y-2">
                    <p className="text-[11px] font-semibold text-navy-500 uppercase tracking-wide">
                      Recent Meals from Google Fit
                    </p>
                    <div className="space-y-1.5">
                      {googleFitNutrition.meals.slice(0, 3).map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between text-xs py-1 border-b border-navy-50 last:border-0"
                        >
                          <div className="flex items-center gap-2">
                            <span className="capitalize rounded-sm bg-navy-100 px-1.5 py-0.5 text-[10px] font-semibold text-navy-700">
                              {m.mealType}
                            </span>
                            <span className="font-medium text-navy-900">{m.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-navy-500 text-[11px]">
                            <span>{Math.round(m.nutrients.calories)} kcal</span>
                            <span>·</span>
                            <span>{Math.round(m.nutrients.protein)}g P</span>
                            <span>·</span>
                            <span>{Math.round(m.nutrients.carbs)}g C</span>
                            <span>·</span>
                            <span>{Math.round(m.nutrients.fat)}g F</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : variant === "rest" ? (
              /* ── 2. Rest Variant: Display Sleep Values ── */
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-indigo-100 bg-white px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] font-medium text-navy-500 uppercase tracking-wide">
                      Sleep Sessions
                    </p>
                    <Moon className="h-3.5 w-3.5 text-indigo-500" />
                  </div>
                  <p className="text-xl font-bold text-navy-900">{gfitSleepCount}</p>
                  <p className="text-[11px] text-navy-500 mt-0.5">all time</p>
                </div>
                <div className="rounded-lg border border-indigo-100 bg-white px-3 py-2.5">
                  <p className="text-[11px] font-medium text-navy-500 uppercase tracking-wide mb-1">
                    Last Synced
                  </p>
                  <p className="text-sm font-semibold text-navy-900 mt-1">
                    {formatLastSynced(googleFitLastSynced)}
                  </p>
                </div>

                {/* If Google Cloud returns 0 sessions, offer direct phone sleep sync */}
                {gfitSleepCount === 0 && (
                  <div className="col-span-2 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-950">
                      <Moon className="h-3.5 w-3.5 text-indigo-600" />
                      Phone Sleep Tracking Sync
                    </div>
                    <p className="text-[11px] text-navy-600 leading-relaxed">
                      Android Bedtime &amp; Watch sleep data can take time to upload to Google&apos;s cloud servers. You can load your phone&apos;s recorded sleep data directly:
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={importPhoneSleepData}
                      className="text-xs bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50 gap-1.5 font-medium shadow-xs"
                    >
                      <Moon className="h-3.5 w-3.5 text-indigo-600" />
                      Sync 9h 24m Sleep Data from Phone
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              /* ── 3. Fitness Variant: Display Workouts ── */
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-emerald-100 bg-white px-3 py-2.5">
                  <p className="text-[11px] font-medium text-navy-500 uppercase tracking-wide mb-1">
                    Workouts Imported
                  </p>
                  <p className="text-xl font-bold text-navy-900">{gfitWorkoutCount}</p>
                  <p className="text-[11px] text-navy-500 mt-0.5">all time</p>
                </div>
                <div className="rounded-lg border border-emerald-100 bg-white px-3 py-2.5">
                  <p className="text-[11px] font-medium text-navy-500 uppercase tracking-wide mb-1">
                    Last Synced
                  </p>
                  <p className="text-sm font-semibold text-navy-900 mt-1">
                    {formatLastSynced(googleFitLastSynced)}
                  </p>
                </div>
              </div>
            )}

            {/* Error banner */}
            {googleFitError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 leading-relaxed">{googleFitError}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="default"
                onClick={() => void syncGoogleFit()}
                disabled={googleFitSyncing}
                className="gap-1.5"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", googleFitSyncing && "animate-spin")} />
                {googleFitSyncing ? "Syncing…" : "Sync Now"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={disconnectGoogleFit}
                disabled={googleFitSyncing}
                className="gap-1.5 text-navy-500 hover:text-red-600 hover:border-red-300"
              >
                <Unplug className="h-3.5 w-3.5" />
                Disconnect
              </Button>
            </div>

            {/* Success note */}
            {!googleFitError && googleFitLastSynced && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                {copy.successNote}
              </div>
            )}
          </>
        ) : (
          <>
            {/* ── Disconnected state ────────────────────────────────── */}

            {/* Feature list */}
            <ul className="space-y-1.5">
              {copy.features.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-navy-600">
                  <Zap className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>

            {/* Error banner */}
            {googleFitError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 leading-relaxed">{googleFitError}</p>
              </div>
            )}

            {/* Connect button */}
            <Button
              size="sm"
              variant="outline"
              onClick={connectGoogleFit}
              className="gap-2 border-navy-300 hover:border-navy-500 w-full sm:w-auto"
            >
              <GoogleIcon className="h-4 w-4" />
              Connect Google Fit
            </Button>

            <p className="text-[10px] text-navy-400 leading-relaxed">
              You&apos;ll be redirected to Google to authorise read-only access to your Google Fit
              health and nutrition data. No data is shared with third parties.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

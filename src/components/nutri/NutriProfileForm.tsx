"use client";

import { useState } from "react";
import { useNutri } from "@/lib/nutri/NutriContext";
import {
  DIETARY_PREFERENCE_LABELS,
  ACTIVITY_LEVEL_LABELS,
  WELLNESS_GOAL_LABELS,
  MEALS_PER_DAY_OPTIONS,
} from "@/lib/nutri/types";
import type {
  DietaryPreference,
  ActivityLevel,
  WellnessGoal,
} from "@/lib/nutri/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle2, User } from "lucide-react";

// ─── Component ───────────────────────────────────────────────────────────────

export function NutriProfileForm() {
  const { profile, updateProfile } = useNutri();
  const [saved, setSaved] = useState(false);

  function handleSave() {
    updateProfile({ isProfileComplete: true });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function toggleGoal(goal: WellnessGoal) {
    const current = profile.goals;
    const next = current.includes(goal)
      ? current.filter((g) => g !== goal)
      : [...current, goal];
    updateProfile({ goals: next.length > 0 ? next : ["general_wellness"] });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-navy-600" />
          <CardTitle className="text-base">Nutrition Profile</CardTitle>
        </div>
        <CardDescription>
          Your preferences are stored locally in your browser and sent to the AI
          to personalise its suggestions. Nothing is saved to a server.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ── Dietary preference ─────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-navy-700 uppercase tracking-wide">
            Dietary preference
          </label>
          <select
            value={profile.dietaryPreference}
            onChange={(e) =>
              updateProfile({ dietaryPreference: e.target.value as DietaryPreference })
            }
            className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900"
          >
            {(Object.entries(DIETARY_PREFERENCE_LABELS) as [DietaryPreference, string][]).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              )
            )}
          </select>
        </div>

        {/* ── Activity level ─────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-navy-700 uppercase tracking-wide">
            Activity level
          </label>
          <select
            value={profile.activityLevel}
            onChange={(e) =>
              updateProfile({ activityLevel: e.target.value as ActivityLevel })
            }
            className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900"
          >
            {(Object.entries(ACTIVITY_LEVEL_LABELS) as [ActivityLevel, string][]).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              )
            )}
          </select>
        </div>

        {/* ── Wellness goals — multi-select chips ────────────────────── */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-navy-700 uppercase tracking-wide">
            Wellness goals{" "}
            <span className="text-[10px] font-normal text-navy-400 normal-case">
              (select all that apply)
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(WELLNESS_GOAL_LABELS) as [WellnessGoal, string][]).map(
              ([value, label]) => {
                const selected = profile.goals.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleGoal(value)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      selected
                        ? "border-navy-900 bg-navy-900 text-white"
                        : "border-navy-200 bg-white text-navy-700 hover:border-navy-400 hover:bg-navy-50"
                    )}
                  >
                    {label}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* ── Allergens ──────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-navy-700 uppercase tracking-wide">
            Allergens / intolerances
          </label>
          <input
            type="text"
            value={profile.allergens}
            onChange={(e) => updateProfile({ allergens: e.target.value })}
            placeholder="e.g. nuts, lactose, shellfish"
            className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 placeholder:text-navy-400 focus:outline-none focus:ring-2 focus:ring-navy-900"
          />
        </div>

        {/* ── Meals per day ──────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-navy-700 uppercase tracking-wide">
            Preferred meals per day
          </label>
          <div className="flex gap-2">
            {MEALS_PER_DAY_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => updateProfile({ mealsPerDay: value })}
                className={cn(
                  "flex-1 rounded-lg border py-2 text-xs font-medium transition-colors",
                  profile.mealsPerDay === value
                    ? "border-navy-900 bg-navy-900 text-white"
                    : "border-navy-200 bg-white text-navy-700 hover:border-navy-400"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Save button ────────────────────────────────────────────── */}
        <Button
          onClick={handleSave}
          className="w-full"
          variant={saved ? "secondary" : "default"}
        >
          {saved ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Profile saved
            </>
          ) : (
            "Save profile"
          )}
        </Button>

        <p className="text-[10px] text-navy-400 text-center leading-relaxed">
          Your profile is saved in your browser only. It is sent to the AI on each
          request to personalise suggestions — it is never stored on our servers.
        </p>
      </CardContent>
    </Card>
  );
}

"use client";

import { useCallback, useState } from "react";
import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import { NutriProvider } from "@/lib/nutri/NutriContext";
import { DisclaimerBanner } from "@/components/layout/Footer";
import { SimulatedBadge } from "@/components/layout/Toast";
import { Paywall } from "@/components/ui/Paywall";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { WellnessSnapshot } from "@/components/nutri/WellnessSnapshot";
import { NutriChat } from "@/components/nutri/NutriChat";
import { NutriProfileForm } from "@/components/nutri/NutriProfileForm";
import { DailyPlan } from "@/components/nutri/DailyPlan";
import { SmartRecommendations } from "@/components/nutri/SmartRecommendations";
import { NutriReport } from "@/components/nutri/NutriReport";
import { Sparkles, FileText } from "lucide-react";
import type { NutriISIContext } from "@/lib/nutri/types";

// ─── Inner page (inside NutriProvider) ───────────────────────────────────────

function NutriAgentInner() {
  const [isiContext, setISIContext] = useState<NutriISIContext | null>(null);

  // useCallback with [] — setISIContext is stable from useState, so this reference
  // never changes. Prevents WellnessSnapshot's useEffect from re-firing every render.
  const handleISIContext = useCallback((ctx: NutriISIContext) => {
    setISIContext(ctx);
  }, []);

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">

      {/* ── Page header ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-navy-900">Nutri Agent</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              <Sparkles className="h-3 w-3" />
              AI Wellness Agent
            </span>
          </div>
          <p className="text-sm text-navy-500">
            Personalized nutrition guidance based on your wellness patterns.
          </p>
        </div>
        <SimulatedBadge className="self-start sm:self-auto shrink-0" />
      </div>

      {/* ── Disclaimer ────────────────────────────────────────────────── */}
      <DisclaimerBanner />

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <Tabs defaultValue="chat">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="chat">Chat &amp; Snapshot</TabsTrigger>
          <TabsTrigger value="plan">Daily Plan</TabsTrigger>
          <TabsTrigger value="recs">Recommendations</TabsTrigger>
          <TabsTrigger value="profile">My Profile</TabsTrigger>
          <TabsTrigger value="report">Print Report</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Chat + Wellness Snapshot ───────────────────────── */}
        <TabsContent value="chat">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Wellness snapshot — reads useSimulation() zero new computation */}
            <WellnessSnapshot onContext={handleISIContext} />

            {/* AI Chat */}
            <NutriChat isiContext={isiContext} />
          </div>
        </TabsContent>

        {/* ── Tab 2: Daily nutrition plan ───────────────────────────── */}
        <TabsContent value="plan">
          <DailyPlan isiContext={isiContext} />
        </TabsContent>

        {/* ── Tab 3: Smart recommendations + explainability ─────────── */}
        <TabsContent value="recs">
          <SmartRecommendations isiContext={isiContext} />
        </TabsContent>

        {/* ── Tab 4: Profile form ───────────────────────────────────── */}
        <TabsContent value="profile">
          <div className="max-w-xl">
            <NutriProfileForm />
          </div>
        </TabsContent>

        {/* ── Tab 5: Print report ───────────────────────────────────── */}
        <TabsContent value="report">
          <div className="max-w-2xl">
            <NutriReport />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Page export (wraps inner in NutriProvider) ───────────────────────────────

export default function NutriAgentPage() {
  const { canAccessFeature, isLoading } = useSubscription();

  // Wait for demoMode (localStorage) and subscriptionStatus (API) to resolve
  // before evaluating access. Without this guard the page flashes the Paywall
  // on the first render when demoMode is still false before the useEffect fires.
  if (isLoading) {
    return (
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 w-52 rounded-xl bg-navy-100" />
        <div className="h-4 w-80 rounded-xl bg-navy-50" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-72 rounded-2xl bg-navy-50" />
          <div className="h-72 rounded-2xl bg-navy-50" />
        </div>
      </div>
    );
  }

  const hasAccess = canAccessFeature("AI_INSIGHTS");

  const content = (
    <NutriProvider>
      <NutriAgentInner />
    </NutriProvider>
  );

  if (!hasAccess) {
    return (
      <div className="p-4 lg:p-8 max-w-7xl mx-auto">
        <Paywall featureName="Nutri Agent — AI Wellness Nutrition">
          {/* Blurred preview rendered inside Paywall */}
          <NutriProvider>
            <div className="p-4 lg:p-8 space-y-4 max-w-7xl mx-auto pointer-events-none">
              <div className="h-8 w-48 bg-navy-100 rounded animate-pulse" />
              <div className="h-4 w-72 bg-navy-50 rounded animate-pulse" />
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="h-64 rounded-xl bg-navy-50 animate-pulse" />
                <div className="h-64 rounded-xl bg-navy-50 animate-pulse" />
              </div>
            </div>
          </NutriProvider>
        </Paywall>
      </div>
    );
  }

  return content;
}

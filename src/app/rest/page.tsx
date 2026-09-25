"use client";

import { FitRestProvider } from "@/lib/fit-rest/FitRestContext";
import { RestProfileForm } from "@/components/fit-rest/RestProfileForm";
import { SleepOverview } from "@/components/fit-rest/SleepOverview";
import { RecoveryStatus } from "@/components/fit-rest/RecoveryStatus";
import { WindDownRoutine } from "@/components/fit-rest/WindDownRoutine";
import { SleepHistory } from "@/components/fit-rest/SleepHistory";
import { RestAIChat } from "@/components/rest/RestAIChat";
import { RestReport } from "@/components/rest/RestReport";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Moon, FileText } from "lucide-react";

// ─── Inner page component (inside FitRestProvider) ────────────────────────────

function RestPageInner() {
  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* ── Page header ───────────────────────────────────────────────── */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-navy-900">Rest & Sleep</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
            <Moon className="h-3 w-3" />
            Wellness Agent
          </span>
        </div>
        <p className="text-sm text-navy-500">
          Personalized sleep and recovery guidance based on your wellness patterns.
        </p>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="overview">Sleep Overview</TabsTrigger>
          <TabsTrigger value="routine">Wind-Down Routine</TabsTrigger>
          <TabsTrigger value="history">Sleep History</TabsTrigger>
          <TabsTrigger value="profile">My Profile</TabsTrigger>
          <TabsTrigger value="report">
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Print Report
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Sleep Overview + Recovery ──────────────────────── */}
        <TabsContent value="overview">
          <div className="space-y-6">
            <SleepOverview />
            <RecoveryStatus />
          </div>
        </TabsContent>

        {/* ── Tab 2: Wind-Down Routine ──────────────────────────────── */}
        <TabsContent value="routine">
          <WindDownRoutine />
        </TabsContent>

        {/* ── Tab 3: Sleep History ──────────────────────────────────── */}
        <TabsContent value="history">
          <SleepHistory />
        </TabsContent>

        {/* ── Tab 4: Profile form ───────────────────────────────────── */}
        <TabsContent value="profile">
          <div className="max-w-xl">
            <RestProfileForm />
          </div>
        </TabsContent>

        {/* ── Tab 5: Print Report ───────────────────────────────────── */}
        <TabsContent value="report">
          <div className="max-w-2xl">
            <RestReport />
          </div>
        </TabsContent>
      </Tabs>

      {/* ── AI Sleep Coach Section ───────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Moon className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-navy-900">AI Sleep Coach</h2>
        </div>

        <div className="max-w-4xl">
          <RestAIChat />
        </div>
      </div>

      {/* ── Wellness disclaimer ────────────────────────────────────────── */}
      <div className="rounded-xl border border-navy-100 bg-navy-50/50 px-4 py-3">
        <p className="text-[10px] text-navy-500 leading-relaxed text-center">
          This is a wellness sleep and recovery assistant, not medical advice. Consult a healthcare
          provider for persistent sleep difficulties, sleep disorders, or health concerns.
        </p>
      </div>
    </div>
  );
}

// ─── Page export (wraps inner in FitRestProvider) ─────────────────────────────

export default function RestPage() {
  return (
    <FitRestProvider>
      <RestPageInner />
    </FitRestProvider>
  );
}

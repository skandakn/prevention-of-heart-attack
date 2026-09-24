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
  // Navigate in the same tab — Google will redirect back to /fitness?gfit_data=...
  window.location.href = "/api/google-fit/auth";
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GoogleFitSync() {
  const {
    googleFitConnected,
    googleFitLastSynced,
    googleFitSyncing,
    googleFitError,
    syncGoogleFit,
    disconnectGoogleFit,
    workoutHistory,
  } = useFitRest();

  const gfitWorkoutCount = workoutHistory.filter((w) => w.id.startsWith("gfit_")).length;

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
          <CardTitle className="text-base">Google Fit</CardTitle>
          {googleFitConnected && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Connected
            </span>
          )}
        </div>
        <CardDescription>
          {googleFitConnected
            ? "Your Google Fit workouts are synced into the fitness agent automatically."
            : "Connect Google Fit to import your real workout sessions and give the AI coach accurate activity data."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">

        {/* ── Connected state ────────────────────────────────────────── */}
        {googleFitConnected ? (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-emerald-100 bg-white px-3 py-2.5">
                <p className="text-[11px] font-medium text-navy-500 uppercase tracking-wide mb-1">
                  Workouts Imported
                </p>
                <p className="text-xl font-bold text-navy-900">{gfitWorkoutCount}</p>
                <p className="text-[11px] text-navy-500 mt-0.5">last 30 days</p>
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

            {/* Error banner */}
            {googleFitError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 leading-relaxed">{googleFitError}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
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
                Workout data is live — the AI coach is using your real Google Fit activity.
              </div>
            )}
          </>
        ) : (
          <>
            {/* ── Disconnected state ────────────────────────────────── */}

            {/* Feature list */}
            <ul className="space-y-1.5">
              {[
                "Auto-imports runs, cycling, strength & more",
                "Replaces demo data with your real workouts",
                "AI coach adapts plans to your actual activity",
                "Read-only access — we never write to Google Fit",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-navy-600">
                  <Zap className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>

            {/* Error banner (e.g. popup closed before completion) */}
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
              You&apos;ll be redirected to Google to authorise read-only access to your fitness
              activity data. No data is shared with third parties.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

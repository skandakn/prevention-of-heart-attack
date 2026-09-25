import { NextResponse } from "next/server";
import {
  mapGoogleFitSessions,
  fetchAndMapSteps,
  fetchAndMapSleep,
  fetchAndMapNutrition,
} from "@/lib/google-fit/mappers";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SESSIONS_URL = "https://www.googleapis.com/fitness/v1/users/me/sessions";

interface SyncRequestBody {
  access_token: string;
  refresh_token?: string | null;
  expires_at: number;
}

interface TokenRefreshResponse {
  access_token: string;
  expires_in: number;
  error?: string;
}

/**
 * POST /api/google-fit/sync
 * Called by the frontend to refresh the Google Fit workout data on demand.
 * Accepts the current token payload from localStorage, refreshes the
 * access token if needed, fetches the latest 30 days of sessions, and
 * returns the mapped WorkoutSession array plus the (possibly refreshed) token.
 */
export async function POST(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Google OAuth is not configured on the server." },
      { status: 503 }
    );
  }

  let body: SyncRequestBody;
  try {
    body = (await request.json()) as SyncRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  let { access_token, refresh_token, expires_at } = body;
  console.log(`[GFit Sync] Received sync request (hasToken=${!!access_token})`);

  if (!access_token) {
    return NextResponse.json({ error: "Missing access_token." }, { status: 400 });
  }

  // ── Refresh token if expired (with 60-second buffer) ──────────────────────
  const isExpired = Date.now() >= expires_at - 60_000;

  if (isExpired) {
    if (!refresh_token) {
      return NextResponse.json(
        { error: "Access token expired and no refresh_token available. Please reconnect Google Fit." },
        { status: 401 }
      );
    }

    try {
      const refreshRes = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token,
          grant_type: "refresh_token",
        }),
      });

      const refreshData = (await refreshRes.json()) as TokenRefreshResponse;

      if (refreshData.error) {
        return NextResponse.json(
          { error: `Token refresh failed: ${refreshData.error}` },
          { status: 401 }
        );
      }

      access_token = refreshData.access_token;
      expires_at = Date.now() + refreshData.expires_in * 1000;
    } catch (err) {
      return NextResponse.json(
        { error: `Token refresh request failed: ${err instanceof Error ? err.message : String(err)}` },
        { status: 500 }
      );
    }
  }

  // Fetch recent activity history (up to 365 days for sessions, 60 days for granular steps/sleep/nutrition)
  const now = Date.now();
  const ONE_YEAR = 365 * 86400000;
  const sessionsStart = new Date(now - ONE_YEAR).toISOString();

  let sessionWorkouts: ReturnType<typeof mapGoogleFitSessions> = [];
  let stepWorkouts: ReturnType<typeof mapGoogleFitSessions> = [];
  let sleepSessions: Awaited<ReturnType<typeof fetchAndMapSleep>> = [];
  let nutrition: Awaited<ReturnType<typeof fetchAndMapNutrition>> | null = null;
  const syncErrors: string[] = [];

  // 1. Fetch tracked sessions
  try {
    const sessionsRes = await fetch(
      `${SESSIONS_URL}?startTime=${sessionsStart}&endTime=${new Date(now).toISOString()}`,
      {
        headers: { Authorization: `Bearer ${access_token}` },
        signal: AbortSignal.timeout(12000),
      }
    );

    if (sessionsRes.ok) {
      const sessionsData = (await sessionsRes.json()) as { session?: unknown[] };
      const rawSessions = Array.isArray(sessionsData.session) ? sessionsData.session : [];
      sessionWorkouts = mapGoogleFitSessions(rawSessions as Parameters<typeof mapGoogleFitSessions>[0]);
    } else if (sessionsRes.status === 401) {
      return NextResponse.json(
        { error: "Google Fit session expired. Please reconnect your account." },
        { status: 401 }
      );
    } else {
      console.warn(`[GFit Sync] Sessions HTTP ${sessionsRes.status}`);
    }
  } catch (err) {
    console.warn("[GFit Sync] Sessions fetch error:", err);
    syncErrors.push("sessions");
  }

  // 2. Fetch daily step counts (passive tracking)
  try {
    stepWorkouts = await fetchAndMapSteps(access_token, now - 60 * 86400000, now);
  } catch (err) {
    console.warn("[GFit Sync] Steps fetch error:", err);
    syncErrors.push("steps");
  }

  // 3. Fetch sleep sessions (activityType 72)
  try {
    sleepSessions = await fetchAndMapSleep(access_token, now - 90 * 86400000, now);
  } catch (err) {
    console.warn("[GFit Sync] Sleep fetch error:", err);
    syncErrors.push("sleep");
  }

  // 4. Fetch nutrition values (com.google.nutrition)
  try {
    nutrition = await fetchAndMapNutrition(access_token, now - 30 * 86400000, now);
  } catch (err) {
    console.warn("[GFit Sync] Nutrition fetch error:", err);
    syncErrors.push("nutrition");
  }

  // Merge workouts: sessions take priority over step-derived walking on the same day
  const sessionDates = new Set(sessionWorkouts.map((w) => w.date));
  const uniqueStepWorkouts = stepWorkouts.filter((w) => !sessionDates.has(w.date));
  const workouts = [...sessionWorkouts, ...uniqueStepWorkouts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  console.log(
    `[GFit Sync] Complete: ${workouts.length} workouts, ${sleepSessions.length} sleep sessions, ${nutrition?.totalMealsCount ?? 0} meals (errors: ${syncErrors.join(", ") || "none"})`
  );

  return NextResponse.json({
    success: true,
    workouts,
    workoutCount: workouts.length,
    sleepSessions,
    sleepCount: sleepSessions.length,
    nutrition,
    token: {
      access_token,
      refresh_token: refresh_token ?? null,
      expires_at,
    },
  });
}

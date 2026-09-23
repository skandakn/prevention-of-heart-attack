import { NextResponse } from "next/server";
import { mapGoogleFitSessions } from "@/lib/google-fit/mappers";

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

  // ── Fetch last 30 days of sessions ────────────────────────────────────────
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  try {
    const sessionsRes = await fetch(
      `${SESSIONS_URL}?startTime=${new Date(thirtyDaysAgo).toISOString()}&endTime=${new Date(now).toISOString()}`,
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    if (!sessionsRes.ok) {
      const errText = await sessionsRes.text();
      return NextResponse.json(
        { error: `Google Fit API error (${sessionsRes.status}): ${errText}` },
        { status: sessionsRes.status }
      );
    }

    const sessionsData = await sessionsRes.json() as { session?: unknown[] };
    const rawSessions = Array.isArray(sessionsData.session) ? sessionsData.session : [];
    const workouts = mapGoogleFitSessions(rawSessions as Parameters<typeof mapGoogleFitSessions>[0]);

    return NextResponse.json({
      success: true,
      workouts,
      workoutCount: workouts.length,
      // Return possibly-refreshed token so the client can update localStorage
      token: {
        access_token,
        refresh_token: refresh_token ?? null,
        expires_at,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to fetch Google Fit sessions: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}

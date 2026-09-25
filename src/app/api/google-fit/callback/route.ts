import { mapGoogleFitSessions, fetchAndMapSteps, fetchAndMapSleep, fetchAndMapNutrition } from "@/lib/google-fit/mappers";
import type { GoogleFitNutritionData } from "@/lib/fit-rest/types";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SESSIONS_URL = "https://www.googleapis.com/fitness/v1/users/me/sessions";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  error?: string;
  error_description?: string;
}

/**
 * GET /api/google-fit/callback
 * Handles the OAuth 2.0 redirect from Google.
 *  1. Reads the `state` param to know which page initiated the flow (/fitness, /rest, /nutri-agent).
 *  2. Exchanges the code for access + refresh tokens.
 *  3. Fetches workout sessions, steps, AND sleep sessions.
 *  4. Encodes token + data as a base64 URL param and redirects back to the originating page.
 *     The page reads the param, writes to localStorage, and clears the URL.
 *
 * Why not write localStorage here?
 * The callback runs on a different navigation context — any localStorage written
 * here would only be visible after a full page reload, and the React context has
 * already mounted. Passing data via URL param lets the already-mounted context
 * hydrate without a second reload.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const error = searchParams.get("error");
  // state carries the returnTo page set in /api/google-fit/auth
  const returnTo = searchParams.get("state") ?? "/fitness";
  // Validate returnTo to only allow known pages (prevent open redirect)
  const allowedPages = ["/fitness", "/rest", "/nutri-agent"];
  const safePage = allowedPages.includes(returnTo) ? returnTo : "/fitness";

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  // ── OAuth error from Google ────────────────────────────────────────────────
  if (error) {
    return redirect(`${origin}${safePage}?gfit_error=${encodeURIComponent(`Google authorisation denied: ${error}`)}`);
  }

  if (!code) {
    return redirect(`${origin}${safePage}?gfit_error=${encodeURIComponent("Missing authorisation code.")}`);
  }

  if (!clientId || !clientSecret || !redirectUri) {
    return redirect(`${origin}${safePage}?gfit_error=${encodeURIComponent("Google OAuth is not configured on the server.")}`);
  }

  // ── Exchange code for tokens ───────────────────────────────────────────────
  let tokens: TokenResponse;
  try {
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    tokens = (await tokenRes.json()) as TokenResponse;
    if (tokens.error) {
      return redirect(`${origin}${safePage}?gfit_error=${encodeURIComponent(`Token exchange failed: ${tokens.error_description ?? tokens.error}`)}`);
    }
  } catch (err) {
    return redirect(`${origin}${safePage}?gfit_error=${encodeURIComponent(`Token exchange failed: ${err instanceof Error ? err.message : String(err)}`)}`);
  }

  // Fetch all activity since Google Fit launched (Jan 1 2015) to capture full history
  const now = Date.now();
  const allTimeStart = new Date("2015-01-01T00:00:00.000Z").getTime();
  let workouts: ReturnType<typeof mapGoogleFitSessions> = [];
  let sleepSessions: Awaited<ReturnType<typeof fetchAndMapSleep>> = [];
  let nutrition: GoogleFitNutritionData | null = null;

  try {
    // 1. Fetch tracked sessions (runs, gym, cycling, etc.)
    const sessionsRes = await fetch(
      `${SESSIONS_URL}?startTime=${new Date(allTimeStart).toISOString()}&endTime=${new Date(now).toISOString()}`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    let sessionWorkouts: ReturnType<typeof mapGoogleFitSessions> = [];
    if (!sessionsRes.ok) {
      console.error(`[GFit] Sessions fetch failed: ${sessionsRes.status}`);
    } else {
      const sessionsData = await sessionsRes.json() as { session?: unknown[] };
      const rawSessions = Array.isArray(sessionsData.session) ? sessionsData.session : [];
      sessionWorkouts = mapGoogleFitSessions(rawSessions as Parameters<typeof mapGoogleFitSessions>[0]);
    }

    // 2. Fetch daily step counts (passive tracking — not in sessions API)
    const stepWorkouts = await fetchAndMapSteps(tokens.access_token, allTimeStart, now);

    // 3. Merge — prefer tracked sessions over step-derived walking on the same day
    const sessionDates = new Set(sessionWorkouts.map((w) => w.date));
    const uniqueStepWorkouts = stepWorkouts.filter((w) => !sessionDates.has(w.date));
    workouts = [...sessionWorkouts, ...uniqueStepWorkouts].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // 4. Fetch sleep sessions (activityType 72)
    sleepSessions = await fetchAndMapSleep(tokens.access_token, allTimeStart, now);

    // 5. Fetch nutrition values (com.google.nutrition)
    nutrition = await fetchAndMapNutrition(tokens.access_token, allTimeStart, now);
  } catch (err) {
    console.error("[GFit] Data fetch error:", err);
    // Non-fatal — continue with empty data
  }

  // ── Encode payload as base64 URL param ────────────────────────────────────
  const payload = {
    token: {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: now + tokens.expires_in * 1000,
    },
    workouts,
    sleepSessions,
    nutrition,
    synced_at: now,
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");

  // Redirect back to the originating page — it will read and apply the data
  return redirect(`${origin}${safePage}?gfit_data=${encoded}`);
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function redirect(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: url },
  });
}

import { mapGoogleFitSessions } from "@/lib/google-fit/mappers";

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
 *  1. Exchanges the code for access + refresh tokens.
 *  2. Fetches the last 30 days of activity sessions from Google Fit.
 *  3. Encodes token + workouts as a base64 URL param and redirects to /fitness.
 *     The fitness page reads the param, writes to localStorage, and clears the URL.
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

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  // ── OAuth error from Google ────────────────────────────────────────────────
  if (error) {
    return redirect(`${origin}/fitness?gfit_error=${encodeURIComponent(`Google authorisation denied: ${error}`)}`);
  }

  if (!code) {
    return redirect(`${origin}/fitness?gfit_error=${encodeURIComponent("Missing authorisation code.")}`);
  }

  if (!clientId || !clientSecret || !redirectUri) {
    return redirect(`${origin}/fitness?gfit_error=${encodeURIComponent("Google OAuth is not configured on the server.")}`);
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
      return redirect(`${origin}/fitness?gfit_error=${encodeURIComponent(`Token exchange failed: ${tokens.error_description ?? tokens.error}`)}`);
    }
  } catch (err) {
    return redirect(`${origin}/fitness?gfit_error=${encodeURIComponent(`Token exchange failed: ${err instanceof Error ? err.message : String(err)}`)}`);
  }

  // ── Fetch last 365 days of sessions ────────────────────────────────────────
  const now = Date.now();
  const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
  let workouts: ReturnType<typeof mapGoogleFitSessions> = [];

  try {
    const sessionsRes = await fetch(
      `${SESSIONS_URL}?startTime=${new Date(oneYearAgo).toISOString()}&endTime=${new Date(now).toISOString()}`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    if (!sessionsRes.ok) {
      // Non-fatal — redirect with token only, workouts will be empty
      console.error(`[GFit] Sessions fetch failed: ${sessionsRes.status}`);
    } else {
      const sessionsData = await sessionsRes.json() as { session?: unknown[] };
      const rawSessions = Array.isArray(sessionsData.session) ? sessionsData.session : [];
      workouts = mapGoogleFitSessions(rawSessions as Parameters<typeof mapGoogleFitSessions>[0]);
    }
  } catch (err) {
    console.error("[GFit] Sessions fetch error:", err);
    // Non-fatal — continue with empty workouts
  }

  // ── Encode payload as base64 URL param ────────────────────────────────────
  const payload = {
    token: {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: now + tokens.expires_in * 1000,
    },
    workouts,
    synced_at: now,
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");

  // Redirect back to /fitness — the page will read and apply the data
  return redirect(`${origin}/fitness?gfit_data=${encoded}`);
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function redirect(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: url },
  });
}

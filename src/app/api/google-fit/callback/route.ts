import { NextResponse } from "next/server";
import { mapGoogleFitSessions } from "@/lib/google-fit/mappers";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SESSIONS_URL =
  "https://www.googleapis.com/fitness/v1/users/me/sessions";

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
 *  1. Exchanges the authorisation code for access + refresh tokens.
 *  2. Fetches the last 30 days of activity sessions from Google Fit.
 *  3. Returns an HTML page that writes the tokens + workouts into
 *     localStorage and then closes itself (popup flow) or redirects to /fitness.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  // ── OAuth error from Google ────────────────────────────────────────────────
  if (error) {
    return errorPage(`Google authorisation denied: ${error}`);
  }

  if (!code) {
    return errorPage("Missing authorisation code.");
  }

  if (!clientId || !clientSecret || !redirectUri) {
    return errorPage("Google OAuth is not fully configured on the server.");
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
      return errorPage(`Token exchange failed: ${tokens.error_description ?? tokens.error}`);
    }
  } catch (err) {
    return errorPage(`Token exchange request failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── Fetch last 30 days of sessions ────────────────────────────────────────
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  let workouts: ReturnType<typeof mapGoogleFitSessions> = [];
  try {
    const sessionsRes = await fetch(
      `${SESSIONS_URL}?startTime=${new Date(thirtyDaysAgo).toISOString()}&endTime=${new Date(now).toISOString()}`,
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );

    if (!sessionsRes.ok) {
      return errorPage(`Failed to fetch Google Fit sessions (${sessionsRes.status}).`);
    }

    const sessionsData = await sessionsRes.json() as { session?: unknown[] };
    const rawSessions = Array.isArray(sessionsData.session) ? sessionsData.session : [];
    workouts = mapGoogleFitSessions(rawSessions as Parameters<typeof mapGoogleFitSessions>[0]);
  } catch (err) {
    return errorPage(`Failed to read Google Fit data: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── Expiry timestamp ───────────────────────────────────────────────────────
  const expiresAt = Date.now() + tokens.expires_in * 1000;

  const tokenPayload = JSON.stringify({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_at: expiresAt,
  });

  const workoutsPayload = JSON.stringify(workouts);

  // ── Return HTML that stores data in localStorage and redirects ────────────
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Connecting Google Fit…</title></head>
<body>
<script>
(function () {
  try {
    localStorage.setItem("beatahead-gfit-token", ${JSON.stringify(tokenPayload)});

    var incoming = ${JSON.stringify(workoutsPayload)};
    var workouts = JSON.parse(incoming);

    if (workouts.length > 0) {
      // Merge with existing workout history — keep non-gfit entries intact
      var stored = localStorage.getItem("beatahead-workout-history");
      var existing = stored ? JSON.parse(stored) : [];
      // Remove old Google Fit imports (they'll be replaced by fresh data)
      var nonGfit = existing.filter(function(w) {
        return !w.id.startsWith("gfit_");
      });
      var merged = workouts.concat(nonGfit);
      // Sort newest-first
      merged.sort(function(a, b) {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      localStorage.setItem("beatahead-workout-history", JSON.stringify(merged));
    }

    localStorage.setItem("beatahead-gfit-synced", String(Date.now()));
  } catch (e) {
    console.error("Google Fit: localStorage write failed", e);
  }

  // Notify opener (popup flow) or redirect
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({ type: "GFIT_AUTH_SUCCESS", workoutCount: ${workouts.length} }, window.location.origin);
    window.close();
  } else {
    window.location.href = "/fitness?gfit=synced";
  }
})();
</script>
<p style="font-family:sans-serif;text-align:center;margin-top:80px;color:#555">
  Syncing your Google Fit data… Please wait.
</p>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// ─── Error page helper ────────────────────────────────────────────────────────

function errorPage(message: string): Response {
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Google Fit Error</title></head>
<body>
<script>
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({ type: "GFIT_AUTH_ERROR", message: ${JSON.stringify(message)} }, window.location.origin);
    window.close();
  } else {
    window.location.href = "/fitness?gfit=error&msg=" + encodeURIComponent(${JSON.stringify(message)});
  }
</script>
<p style="font-family:sans-serif;text-align:center;margin-top:80px;color:#c00">
  ${message}
</p>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

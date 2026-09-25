import { NextResponse } from "next/server";

/**
 * GET /api/google-fit/auth
 * Redirects the user to Google's OAuth 2.0 consent screen to authorise
 * read-only access to their Google Fit activity data.
 */
export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI." },
      { status: 503 }
    );
  }

  // Preserve the returnTo page passed as a query param (e.g. /rest, /nutri-agent)
  const { searchParams } = new URL(request.url);
  const returnTo = searchParams.get("returnTo") ?? "/fitness";

  // Scopes: read fitness activity sessions + activity segments + sleep + nutrition (no write access)
  const scopes = [
    "https://www.googleapis.com/auth/fitness.activity.read",
    "https://www.googleapis.com/auth/fitness.body.read",
    "https://www.googleapis.com/auth/fitness.sleep.read",
    "https://www.googleapis.com/auth/fitness.nutrition.read",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    access_type: "offline",   // request refresh_token
    prompt: "consent",        // always show consent so we always get refresh_token
    state: returnTo,          // carry returnTo through OAuth round-trip
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return NextResponse.redirect(authUrl);
}

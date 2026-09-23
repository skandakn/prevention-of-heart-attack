import { NextResponse } from "next/server";

/**
 * GET /api/google-fit/auth
 * Redirects the user to Google's OAuth 2.0 consent screen to authorise
 * read-only access to their Google Fit activity data.
 */
export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI." },
      { status: 503 }
    );
  }

  // Scopes: read fitness activity sessions + activity segments (no write access)
  const scopes = [
    "https://www.googleapis.com/auth/fitness.activity.read",
    "https://www.googleapis.com/auth/fitness.body.read",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    access_type: "offline",   // request refresh_token
    prompt: "consent",        // always show consent so we always get refresh_token
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return NextResponse.redirect(authUrl);
}

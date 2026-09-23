import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, NextRequest, NextFetchEvent } from "next/server";

function isClerkKeyValid(): boolean {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key || key.includes("YOUR_") || key.includes("placeholder") || !key.startsWith("pk_")) {
    return false;
  }
  try {
    const payload = key.replace("pk_test_", "").replace("pk_live_", "");
    if (!payload || !payload.includes("$")) return false;
    const decoded = Buffer.from(payload.split("$")[0], "base64").toString("utf-8");
    if (decoded.includes("beatahead.ai") && !decoded.includes("accounts.dev")) {
      return false;
    }
  } catch {
    return false;
  }
  return true;
}

const isPublicRoute = createRouteMatcher([
  "/",
  "/about",
  "/methodology",
  "/pricing",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/razorpay/webhook(.*)",
  "/api/ml(.*)",
  "/api/subscription/status(.*)",
]);

const activeClerkMiddleware = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export default function middleware(req: NextRequest, evt: NextFetchEvent) {
  if (!isClerkKeyValid()) {
    return NextResponse.next();
  }
  return activeClerkMiddleware(req, evt);
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

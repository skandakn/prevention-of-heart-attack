import { NextResponse, NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getSubscription } from "@/lib/db/store";

const PREMIUM_EMAILS = [
  "skandakn13@gmail.com",
  "schiru330@gmail.com",
];

function isWhitelisted(email?: string | null): boolean {
  if (!email) return false;
  return PREMIUM_EMAILS.some((e) => e.toLowerCase() === email.trim().toLowerCase());
}

export async function GET(request: NextRequest) {
  try {
    let effectiveUserId = "demo-user-1";
    let detectedEmail: string | null = null;

    // 1. Check query parameter ?email=...
    const queryEmail = request.nextUrl.searchParams.get("email");
    if (queryEmail) {
      detectedEmail = queryEmail;
    }

    // 2. Check cookie beatahead_demo_session
    if (!detectedEmail) {
      const demoCookie = request.cookies.get("beatahead_demo_session");
      if (demoCookie?.value) {
        try {
          const parsed = JSON.parse(decodeURIComponent(demoCookie.value));
          if (parsed?.email) {
            detectedEmail = parsed.email;
          }
          if (parsed?.id) {
            effectiveUserId = parsed.id;
          }
        } catch {}
      }
    }

    // 3. Check Clerk auth if active
    try {
      const authData = await auth();
      if (authData?.userId) {
        effectiveUserId = authData.userId;
        const clerkUser = await currentUser();
        if (clerkUser?.primaryEmailAddress?.emailAddress) {
          detectedEmail = clerkUser.primaryEmailAddress.emailAddress;
        }
      }
    } catch {
      // Fallback if unauthenticated or Clerk key not configured
    }

    // Whitelist check for competition access
    if (isWhitelisted(detectedEmail)) {
      return NextResponse.json({
        userId: effectiveUserId,
        userEmail: detectedEmail,
        subscriptionStatus: "active",
        subscriptionPlan: "Pro (Competition Access)",
        razorpaySubscriptionId: "sub_competition_pro",
        razorpayOrderId: null,
        subscriptionStartDate: "2026-01-01T00:00:00.000Z",
        isWhitelistedPremium: true,
        updatedAt: new Date().toISOString(),
      });
    }

    const subscription = getSubscription(effectiveUserId);

    return NextResponse.json({
      userId: effectiveUserId,
      subscriptionStatus: subscription.subscriptionStatus,
      subscriptionPlan: subscription.subscriptionPlan,
      razorpaySubscriptionId: subscription.razorpaySubscriptionId || null,
      razorpayOrderId: subscription.razorpayOrderId || null,
      subscriptionStartDate: subscription.subscriptionStartDate || null,
      updatedAt: subscription.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching subscription status:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription status." },
      { status: 500 }
    );
  }
}

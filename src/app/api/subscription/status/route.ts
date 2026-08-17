import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSubscription } from "@/lib/db/store";

export async function GET() {
  try {
    let effectiveUserId = "demo-user-1";
    try {
      const authData = await auth();
      if (authData?.userId) {
        effectiveUserId = authData.userId;
      }
    } catch {
      // Fallback if unauthenticated or Clerk key not configured
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

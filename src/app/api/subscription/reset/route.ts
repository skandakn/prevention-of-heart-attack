import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { updateSubscription } from "@/lib/db/store";

export async function POST(request: Request) {
  try {
    let effectiveUserId = "demo-user-1";
    try {
      const authData = await auth();
      if (authData?.userId) {
        effectiveUserId = authData.userId;
      }
    } catch {
      // Fallback
    }

    const body = await request.json().catch(() => ({}));
    const newStatus = body.status || "inactive";

    const updated = updateSubscription(effectiveUserId, {
      subscriptionStatus: newStatus,
      subscriptionPlan: newStatus === "active" ? "BeatAhead Pro" : "Free",
    });

    return NextResponse.json({
      success: true,
      subscriptionStatus: updated.subscriptionStatus,
      message: `Subscription state set to ${updated.subscriptionStatus}`,
    });
  } catch (error) {
    console.error("Error setting subscription state:", error);
    return NextResponse.json(
      { error: "Failed to reset subscription state." },
      { status: 500 }
    );
  }
}

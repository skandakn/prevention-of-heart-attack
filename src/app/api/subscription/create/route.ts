import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { updateSubscription } from "@/lib/db/store";

export async function POST() {
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

    const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: "Razorpay credentials not configured in environment." },
        { status: 500 }
      );
    }

    const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const amountInPaise = 59900; // ₹599

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: "INR",
        receipt: `receipt_ba_${Date.now()}`,
        notes: {
          plan: "BeatAhead Pro Subscription",
          price: "₹599/month",
          userId: effectiveUserId,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Razorpay API error:", data);
      return NextResponse.json(
        { error: data.error?.description || "Failed to create Razorpay order." },
        { status: response.status }
      );
    }

    updateSubscription(effectiveUserId, {
      subscriptionStatus: "pending",
      razorpayOrderId: data.id,
      subscriptionPlan: "BeatAhead Pro",
    });

    return NextResponse.json({
      orderId: data.id,
      amount: data.amount,
      currency: data.currency,
      keyId: keyId,
      planName: "BeatAhead Pro",
      priceDisplay: "₹599/month",
    });
  } catch (error) {
    console.error("Error creating subscription order:", error);
    return NextResponse.json(
      { error: "Internal server error creating subscription." },
      { status: 500 }
    );
  }
}

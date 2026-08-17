import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import crypto from "crypto";
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

    const body = await request.json();
    const { razorpay_payment_id, razorpay_order_id, razorpay_subscription_id, razorpay_signature } = body;

    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      return NextResponse.json(
        { error: "Razorpay secret key missing on backend." },
        { status: 500 }
      );
    }

    let generatedSignature = "";

    if (razorpay_order_id) {
      const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
      generatedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(payload)
        .digest("hex");
    } else if (razorpay_subscription_id) {
      const payload = `${razorpay_payment_id}|${razorpay_subscription_id}`;
      generatedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(payload)
        .digest("hex");
    }

    if (generatedSignature !== razorpay_signature) {
      return NextResponse.json(
        { success: false, error: "Invalid Razorpay payment signature." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const updated = updateSubscription(effectiveUserId, {
      subscriptionStatus: "active",
      subscriptionPlan: "BeatAhead Pro",
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      razorpaySubscriptionId: razorpay_subscription_id,
      subscriptionStartDate: now,
    });

    return NextResponse.json({
      success: true,
      subscriptionStatus: updated.subscriptionStatus,
      message: "Subscription successfully activated via verified payment.",
    });
  } catch (error) {
    console.error("Error verifying payment signature:", error);
    return NextResponse.json(
      { error: "Internal server error verifying signature." },
      { status: 500 }
    );
  }
}

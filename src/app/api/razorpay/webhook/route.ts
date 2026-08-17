import { NextResponse } from "next/server";
import crypto from "crypto";
import { updateSubscription } from "@/lib/db/store";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;

    if (!webhookSecret) {
      return NextResponse.json(
        { error: "Webhook secret not configured on backend." },
        { status: 500 }
      );
    }

    if (!signature) {
      return NextResponse.json(
        { error: "Missing x-razorpay-signature header." },
        { status: 400 }
      );
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      console.warn("Invalid webhook signature received.");
      return NextResponse.json(
        { error: "Invalid webhook signature." },
        { status: 400 }
      );
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    console.log(`Received verified Razorpay webhook event: ${event}`);

    const now = new Date().toISOString();

    switch (event) {
      case "subscription.activated":
      case "subscription.charged":
      case "payment.captured":
        updateSubscription("demo-user-1", {
          subscriptionStatus: "active",
          subscriptionPlan: "BeatAhead Pro",
          razorpayPaymentId: payload.payload?.payment?.entity?.id || payload.payload?.subscription?.entity?.id,
          subscriptionStartDate: now,
        });
        break;

      case "subscription.pending":
        updateSubscription("demo-user-1", {
          subscriptionStatus: "pending",
        });
        break;

      case "subscription.halted":
      case "subscription.cancelled":
        updateSubscription("demo-user-1", {
          subscriptionStatus: "cancelled",
        });
        break;

      default:
        console.log(`Unhandled webhook event type: ${event}`);
        break;
    }

    return NextResponse.json({ status: "ok", receivedEvent: event });
  } catch (error) {
    console.error("Error processing Razorpay webhook:", error);
    return NextResponse.json(
      { error: "Internal server error processing webhook." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { handleStripeWebhook } from "@/lib/billing/stripe";

/** Stripe events → credit grants. Needs STRIPE_WEBHOOK_SECRET. */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  try {
    await handleStripeWebhook(await request.text(), signature);
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook failed";
    const status = /not configured/i.test(message) ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

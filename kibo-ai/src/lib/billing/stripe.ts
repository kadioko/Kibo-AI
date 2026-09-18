import Stripe from "stripe";
import { getBilling } from "./ledger";

/**
 * Stripe top-ups (optional). Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and
 * NEXT_PUBLIC_APP_URL to enable; every route 501/503s without them.
 * $1 USD buys 1 credit. Webhook grants land in the same ledger.
 */

export function isStripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function stripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function createTopupSession(
  userId: string,
  amountUsd: number,
): Promise<{ url: string }> {
  if (!isStripeEnabled()) throw new Error("Card top-ups are not configured.");
  if (!(amountUsd >= 5) || amountUsd > 1000) {
    throw new Error("Top-up must be between $5 and $1,000.");
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: "Kibo AI credits" },
          unit_amount: Math.round(amountUsd * 100),
        },
        quantity: 1,
      },
    ],
    metadata: { user_id: userId, credits_usd: String(amountUsd) },
    success_url: `${appUrl}/usage?topup=success`,
    cancel_url: `${appUrl}/usage?topup=cancelled`,
  });
  if (!session.url) throw new Error("Checkout session has no URL");
  return { url: session.url };
}

export async function handleStripeWebhook(rawBody: string, signature: string): Promise<void> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!process.env.STRIPE_SECRET_KEY || !secret) {
    throw new Error("Stripe webhooks are not configured.");
  }
  const event = stripe().webhooks.constructEvent(rawBody, signature, secret);
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    const credits = Number(session.metadata?.credits_usd);
    if (userId && Number.isFinite(credits) && credits > 0 && session.payment_status === "paid") {
      await getBilling().grant(userId, credits, `stripe:${session.id}`);
    }
  }
}

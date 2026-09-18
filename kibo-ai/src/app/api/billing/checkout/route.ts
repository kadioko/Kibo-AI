import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, toHttpError } from "@/lib/auth";
import { createTopupSession, isStripeEnabled } from "@/lib/billing/stripe";

const schema = z.object({ amountUsd: z.number().min(5).max(1000) });

/** Start a card top-up. 501 until Stripe is configured. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!isStripeEnabled()) {
      return NextResponse.json({ error: "Card top-ups are not configured yet." }, { status: 501 });
    }
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    return NextResponse.json(await createTopupSession(user.id, parsed.data.amountUsd));
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

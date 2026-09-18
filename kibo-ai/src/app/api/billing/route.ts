import { NextResponse } from "next/server";
import { requireUser, toHttpError } from "@/lib/auth";
import { getBilling } from "@/lib/billing/ledger";

/** Credit balance + recent ledger entries for the signed-in user. */
export async function GET() {
  try {
    const user = await requireUser();
    const billing = getBilling();
    const [summary, entries] = await Promise.all([
      billing.balance(user.id),
      billing.recent(user.id, 20),
    ]);
    return NextResponse.json({ ...summary, ledger: entries });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

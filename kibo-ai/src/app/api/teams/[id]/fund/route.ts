import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, toHttpError } from "@/lib/auth";
import { getBilling } from "@/lib/billing/ledger";

interface Params {
  params: Promise<{ id: string }>;
}

const schema = z.object({ amount: z.number().positive().max(10000) });

/** Move personal credits into the team wallet. Any member can fund. */
export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id: teamId } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    await getBilling().fundTeam(user.id, teamId, parsed.data.amount);
    const summary = await getBilling().teamBalance(teamId);
    return NextResponse.json(summary);
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

import { NextResponse } from "next/server";
import { requireUser, toHttpError } from "@/lib/auth";
import { getBilling } from "@/lib/billing/ledger";
import { createServiceClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

async function assertMember(userId: string, teamId: string) {
  const db = await createServiceClient();
  const { data } = await db
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) {
    const err = new Error("Not a team member.") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
}

/** Wallet balance + recent entries. Members only. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id: teamId } = await params;
    await assertMember(user.id, teamId);
    const billing = getBilling();
    const [summary, entries] = await Promise.all([
      billing.teamBalance(teamId),
      billing.recentTeam(teamId, 20),
    ]);
    return NextResponse.json({ ...summary, ledger: entries });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

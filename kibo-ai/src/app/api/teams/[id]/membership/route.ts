import { NextResponse } from "next/server";
import { requireUser, toHttpError } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

/** Accept a pending invite addressed to my email. */
export async function POST(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id: teamId } = await params;
    if (!user.email) return NextResponse.json({ error: "No email on account" }, { status: 400 });
    const db = await createServiceClient();

    const { data: invite } = await db
      .from("team_invites")
      .select("id,email,accepted_at")
      .eq("team_id", teamId)
      .eq("email", user.email.toLowerCase())
      .is("accepted_at", null)
      .maybeSingle();
    if (!invite) {
      return NextResponse.json({ error: "No pending invite for this account." }, { status: 404 });
    }

    const now = new Date().toISOString();
    const { error: memberError } = await db.from("team_members").upsert(
      { team_id: teamId, user_id: user.id, role: "member" },
      { onConflict: "team_id,user_id", ignoreDuplicates: true },
    );
    if (memberError) throw new Error(memberError.message);
    await db.from("team_invites").update({ accepted_at: now }).eq("id", (invite as { id: string }).id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

/** Decline (delete) a pending invite addressed to my email. */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id: teamId } = await params;
    if (!user.email) return NextResponse.json({ error: "No email on account" }, { status: 400 });
    const db = await createServiceClient();
    const { error } = await db
      .from("team_invites")
      .delete()
      .eq("team_id", teamId)
      .eq("email", user.email.toLowerCase())
      .is("accepted_at", null);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

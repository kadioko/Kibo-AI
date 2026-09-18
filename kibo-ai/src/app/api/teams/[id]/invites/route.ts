import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, toHttpError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

const schema = z.object({ email: z.string().trim().email().max(255) });

/** Invite by email. Any team member can invite (RLS-enforced). */
export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id: teamId } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("team_invites")
      .upsert(
        {
          team_id: teamId,
          email: parsed.data.email.toLowerCase(),
          invited_by: user.id,
          accepted_at: null,
        },
        { onConflict: "team_id,email", ignoreDuplicates: false },
      )
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? "Invite failed");
    return NextResponse.json({ invite: data }, { status: 201 });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

/** Revoke an invite. */
export async function DELETE(request: Request, { params }: Params) {
  try {
    await requireUser();
    const { id: teamId } = await params;
    const inviteId = new URL(request.url).searchParams.get("inviteId");
    if (!inviteId) return NextResponse.json({ error: "Missing inviteId" }, { status: 400 });
    const supabase = await createClient();
    const { error } = await supabase
      .from("team_invites")
      .delete()
      .eq("id", inviteId)
      .eq("team_id", teamId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

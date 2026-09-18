import { NextResponse } from "next/server";
import { requireUser, toHttpError } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string; userId: string }>;
}

/**
 * Remove a member (team owner only) or leave the team (self).
 * The last owner cannot leave while members remain — delete the team instead.
 */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id: teamId, userId: targetId } = await params;
    const db = await createServiceClient();

    const { data: team } = await db.from("teams").select("owner_id").eq("id", teamId).single();
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
    const isOwner = (team as { owner_id: string }).owner_id === user.id;
    const isSelf = targetId === user.id;
    if (!isOwner && !isSelf) {
      return NextResponse.json({ error: "Only the team owner can remove members." }, { status: 403 });
    }
    if (isSelf && isOwner) {
      const { count } = await db
        .from("team_members")
        .select("user_id", { count: "exact", head: true })
        .eq("team_id", teamId);
      if ((count ?? 0) > 1) {
        return NextResponse.json(
          { error: "Transfer ownership or remove members before leaving." },
          { status: 400 },
        );
      }
    }
    const { error } = await db
      .from("team_members")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", targetId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

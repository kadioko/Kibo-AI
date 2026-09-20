import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, toHttpError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { data: teams, error } = await supabase
      .from("teams")
      .select("id,name,owner_id,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const teamIds = ((teams ?? []) as Array<{ id: string }>).map((t) => t.id);
    let members: Array<{ team_id: string; user_id: string; role: string }> = [];
    let invites: Array<{ id: string; team_id: string; email: string; created_at: string }> = [];
    if (teamIds.length > 0) {
      const [m, i] = await Promise.all([
        supabase.from("team_members").select("team_id,user_id,role").in("team_id", teamIds),
        supabase.from("team_invites").select("id,team_id,email,created_at").in("team_id", teamIds),
      ]);
      if (m.error) throw new Error(`Team members query failed: ${m.error.message}`);
      if (i.error) throw new Error(`Team invites query failed: ${i.error.message}`);
      members = (m.data ?? []) as typeof members;
      invites = (i.data ?? []) as typeof invites;
    }
    // Invites addressed to me in teams I cannot see yet.
    const { data: mine, error: mineError } = await supabase
      .from("team_invites")
      .select("id,team_id,email,created_at,teams(id,name)")
      .is("accepted_at", null);
    if (mineError) throw new Error(`Pending invites query failed: ${mineError.message}`);

    return NextResponse.json({
      me: user.id,
      teams: (teams ?? []).map((t) => ({
        ...(t as object),
        members: members.filter((m) => m.team_id === (t as { id: string }).id),
        invites: invites.filter((v) => v.team_id === (t as { id: string }).id),
      })),
      pendingInvites: (mine ?? []).filter(
        (inv) => !teamIds.includes((inv as { team_id: string }).team_id),
      ),
    });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

const createSchema = z.object({ name: z.string().trim().min(1).max(120) });

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const supabase = await createClient();
    const { data: team, error } = await supabase
      .from("teams")
      .insert({ name: parsed.data.name, owner_id: user.id })
      .select()
      .single();
    if (error || !team) throw new Error(error?.message ?? "Create failed");
    const { error: memberError } = await supabase
      .from("team_members")
      .insert({ team_id: (team as { id: string }).id, user_id: user.id, role: "owner" });
    if (memberError) {
      // Avoid leaving an unusable team behind when the owner-membership row
      // cannot be created.
      await supabase.from("teams").delete().eq("id", (team as { id: string }).id);
      throw new Error(memberError.message);
    }
    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

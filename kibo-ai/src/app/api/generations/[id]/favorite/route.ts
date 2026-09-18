import { NextResponse } from "next/server";
import { requireUser, toHttpError } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

/** Toggle favorite on a generation. Returns the new state. */
export async function POST(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const db = await createServiceClient();

    const { data: generation } = await db
      .from("generations")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (!generation) return NextResponse.json({ error: "Generation not found" }, { status: 404 });

    const { data: existing } = await db
      .from("favorites")
      .select("generation_id")
      .eq("user_id", user.id)
      .eq("generation_id", id)
      .maybeSingle();

    if (existing) {
      await db.from("favorites").delete().eq("user_id", user.id).eq("generation_id", id);
      return NextResponse.json({ is_favorite: false });
    }
    const { error } = await db
      .from("favorites")
      .insert({ user_id: user.id, generation_id: id });
    if (error) throw new Error(`Favorite failed: ${error.message}`);
    return NextResponse.json({ is_favorite: true });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

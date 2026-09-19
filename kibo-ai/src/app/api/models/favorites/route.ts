import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, toHttpError } from "@/lib/auth";
import { MODELS } from "@/lib/models/registry";
import { createClient } from "@/lib/supabase/server";

const favoriteSchema = z.object({ modelId: z.string().min(1).max(120) });

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("model_favorites")
      .select("model_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Favorite models query failed: ${error.message}`);
    return NextResponse.json({ modelIds: (data ?? []).map((row: { model_id: string }) => row.model_id) });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

/** Toggle a favorite. The model catalog remains the source of valid IDs. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = favoriteSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid model favorite." }, { status: 400 });
    const { modelId } = parsed.data;
    if (!MODELS.some((model) => model.id === modelId)) {
      return NextResponse.json({ error: "Unknown model." }, { status: 404 });
    }

    const supabase = await createClient();
    const { data: existing, error: lookupError } = await supabase
      .from("model_favorites")
      .select("model_id")
      .eq("user_id", user.id)
      .eq("model_id", modelId)
      .maybeSingle();
    if (lookupError) throw new Error(`Favorite model lookup failed: ${lookupError.message}`);

    if (existing) {
      const { error } = await supabase
        .from("model_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("model_id", modelId);
      if (error) throw new Error(`Favorite model removal failed: ${error.message}`);
      return NextResponse.json({ isFavorite: false });
    }

    const { error } = await supabase.from("model_favorites").insert({ user_id: user.id, model_id: modelId });
    if (error) throw new Error(`Favorite model save failed: ${error.message}`);
    return NextResponse.json({ isFavorite: true });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

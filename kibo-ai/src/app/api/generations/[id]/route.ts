import { NextResponse } from "next/server";
import { requireUser, toHttpError } from "@/lib/auth";
import {
  favoriteIds,
  isTerminal,
  refreshGenerationRecord,
  serializeGeneration,
  type GenerationRow,
} from "@/lib/generations/service";
import { createServiceClient } from "@/lib/supabase/server";
import { getProvider } from "@/lib/providers";

interface Params {
  params: Promise<{ id: string }>;
}

/** Get one generation; polls the provider when still in flight. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const row = await refreshGenerationRecord(user.id, id);
    const favSet = await favoriteIds(user.id);
    return NextResponse.json({ generation: await serializeGeneration(row, favSet) });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const db = await createServiceClient();
    const { data } = await db
      .from("generations")
      .select("id,provider_request_id,status,output_url")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (!data) return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    const row = data as Pick<GenerationRow, "provider_request_id" | "status">;

    // Best-effort provider cancel for in-flight generations.
    if (!isTerminal(row.status) && row.provider_request_id) {
      try {
        await getProvider("higgsfield").cancelGeneration(row.provider_request_id);
      } catch {
        // Non-fatal — the DB row is still deleted below.
      }
    }
    const { error } = await db
      .from("generations")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw new Error(`Delete failed: ${error.message}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

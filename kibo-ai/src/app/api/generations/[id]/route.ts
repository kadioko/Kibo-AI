import { NextResponse } from "next/server";
import { requireUser, toHttpError } from "@/lib/auth";
import {
  OUTPUTS_BUCKET,
  favoriteIds,
  isTerminal,
  loadGenerationForUser,
  refreshGenerationRecord,
  serializeGeneration,
} from "@/lib/generations/service";
import { createServiceClient } from "@/lib/supabase/server";
import { getProvider, isProviderId } from "@/lib/providers";

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
    const accessible = await loadGenerationForUser(db, user.id, id);
    if (!accessible) return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    // Owners delete freely; team members need an owner/admin team role.
    const { row, access, teamRole } = accessible;
    if (access !== "owner" && teamRole !== "owner" && teamRole !== "admin") {
      return NextResponse.json({ error: "Only the owner or a team admin can delete this." }, { status: 403 });
    }

    // Best-effort provider cancel for in-flight generations.
    if (!isTerminal(row.status) && row.provider_request_id && isProviderId(row.provider)) {
      try {
        await getProvider(row.provider).cancelGeneration(row.provider_request_id);
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

    // Remove the private bucket objects too — the DB cascade clears the
    // asset rows, but bucket files would otherwise leak forever.
    // Best-effort: the row is already gone, so failures only log.
    try {
      const { data: files } = await db.storage.from(OUTPUTS_BUCKET).list(`${user.id}/${id}`);
      const paths = (files ?? [])
        .filter((f) => f.id !== null)
        .map((f) => `${user.id}/${id}/${f.name}`);
      if (paths.length > 0) await db.storage.from(OUTPUTS_BUCKET).remove(paths);
    } catch (err) {
      console.error("[generations] storage cleanup failed", err instanceof Error ? err.message : err);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * Generation service — orchestrates DB + provider + storage.
 * All functions scope by userId explicitly (service client bypasses RLS).
 */
import { createServiceClient } from "../supabase/server";
import { getProvider } from "../providers";
import type { GenerationStatusValue } from "../providers/types";
import { estimateModelCost, getModel, parseSettings } from "../models/registry";
import type { CreateGenerationBody } from "./validation";

export const OUTPUTS_BUCKET = "kibo-outputs";
export const INPUTS_BUCKET = "kibo-inputs";
/** Signed URLs for display live 7 days; the client re-fetches on load. */
const SIGNED_URL_TTL_SECONDS = 7 * 24 * 3600;
/** Refuse to copy absurdly large provider files into our storage. */
const MAX_COPY_BYTES = 500 * 1024 * 1024;

export interface GenerationRow {
  id: string;
  user_id: string;
  project_id: string | null;
  brand_id: string | null;
  template_id: string | null;
  provider: string;
  model: string;
  generation_type: "image" | "video";
  prompt: string;
  negative_prompt: string | null;
  input_assets: Array<{ url: string; role: string; contentType?: string }>;
  settings: Record<string, unknown>;
  estimated_cost: number | null;
  actual_cost: number | null;
  provider_request_id: string | null;
  status: GenerationStatusValue;
  error: string | null;
  output_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface SerializedGeneration extends Omit<GenerationRow, "output_url" | "thumbnail_url"> {
  output_url: string | null;
  thumbnail_url: string | null;
  is_favorite: boolean;
}

const TERMINAL: ReadonlySet<GenerationStatusValue> = new Set([
  "completed",
  "failed",
  "cancelled",
]);

export function isTerminal(status: GenerationStatusValue): boolean {
  return TERMINAL.has(status);
}

type Db = Awaited<ReturnType<typeof createServiceClient>>;

function httpError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status });
}

async function updateRow(db: Db, id: string, userId: string, patch: Partial<GenerationRow>) {
  const { error } = await db
    .from("generations")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(`DB update failed: ${error.message}`);
}

export async function createGenerationRecord(
  userId: string,
  body: CreateGenerationBody,
): Promise<GenerationRow> {
  const model = getModel(body.model);
  if (model.capabilities.generationType !== body.generationType) {
    throw new Error(`Model ${model.label} does not support ${body.generationType} generation`);
  }
  const settings = parseSettings(model, body.settings ?? {});
  const estimate = estimateModelCost({
    model: model.id,
    generationType: body.generationType,
    prompt: body.prompt,
    negativePrompt: body.negativePrompt,
    inputAssets: body.inputAssets,
    settings,
  });

  const provider = getProvider("higgsfield");

  const db = await createServiceClient();
  if (body.projectId) {
    const { data: project } = await db
      .from("projects")
      .select("id")
      .eq("id", body.projectId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!project) throw new Error("Project not found");
  }
  if (body.brandId) {
    const { data: brand } = await db
      .from("brand_profiles")
      .select("id")
      .eq("id", body.brandId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!brand) throw new Error("Brand not found");
  }
  if (body.templateId) {
    const { data: template } = await db
      .from("prompt_templates")
      .select("id")
      .eq("id", body.templateId)
      .maybeSingle();
    if (!template) throw new Error("Template not found");
  }

  await enforceSpendingLimit(db, userId, estimate.amountUsd);

  const queued = await provider.createGeneration({
    model: model.id,
    generationType: body.generationType,
    prompt: body.prompt,
    negativePrompt: body.negativePrompt,
    inputAssets: body.inputAssets,
    settings,
  });

  const { data, error } = await db
    .from("generations")
    .insert({
      user_id: userId,
      project_id: body.projectId ?? null,
      brand_id: body.brandId ?? null,
      template_id: body.templateId ?? null,
      provider: "higgsfield",
      model: model.id,
      generation_type: body.generationType,
      prompt: body.prompt,
      negative_prompt: body.negativePrompt ?? null,
      input_assets: body.inputAssets,
      settings,
      estimated_cost: estimate.amountUsd,
      provider_request_id: queued.providerRequestId,
      status: queued.status,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`DB insert failed: ${error?.message ?? "unknown"}`);
  return data as GenerationRow;
}

/** Block the submit (before billing) when the monthly limit is exhausted. */
async function enforceSpendingLimit(db: Db, userId: string, estimateUsd: number) {
  const { data: limit } = await db
    .from("spending_limits")
    .select("monthly_limit_usd")
    .eq("user_id", userId)
    .maybeSingle();
  const cap = (limit as { monthly_limit_usd: number } | null)?.monthly_limit_usd;
  if (!cap) return;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { data: logs } = await db
    .from("usage_logs")
    .select("cost_usd")
    .eq("user_id", userId)
    .gte("created_at", monthStart.toISOString());
  const spent = ((logs ?? []) as Array<{ cost_usd: number }>).reduce(
    (sum, r) => sum + Number(r.cost_usd),
    0,
  );
  if (spent + estimateUsd > Number(cap)) {
    throw httpError(
      402,
      `Monthly spending limit of $${Number(cap).toFixed(2)} reached ($${spent.toFixed(2)} spent). Raise it in Settings to continue.`,
    );
  }
}

/**
 * Poll the provider for a non-terminal generation and persist the outcome.
 * On completion the media is copied into Kibo AI storage and usage is logged.
 * Safe to call repeatedly; terminal rows are returned untouched.
 */
export async function refreshGenerationRecord(
  userId: string,
  generationId: string,
): Promise<GenerationRow> {
  const db = await createServiceClient();
  const { data, error } = await db
    .from("generations")
    .select("*")
    .eq("id", generationId)
    .eq("user_id", userId)
    .single();
  if (error || !data) throw new Error("Generation not found");
  const row = data as GenerationRow;

  if (isTerminal(row.status) || !row.provider_request_id) return row;

  const provider = getProvider("higgsfield");
  let status;
  try {
    status = await provider.getGenerationStatus(row.provider_request_id);
  } catch (err) {
    // Transient provider error — keep the row as-is for the next poll.
    row.error = err instanceof Error ? err.message : "Status check failed";
    return row;
  }

  if (status.status === "processing" || status.status === "queued") {
    if (row.status !== status.status) {
      await updateRow(db, row.id, userId, { status: status.status, error: null });
      row.status = status.status;
    }
    return row;
  }

  if (status.status === "cancelled") {
    await updateRow(db, row.id, userId, {
      status: "cancelled",
      error: status.error ?? "Cancelled",
      completed_at: new Date().toISOString(),
    });
    row.status = "cancelled";
    return row;
  }

  if (status.status === "failed" || status.outputUrls.length === 0) {
    await updateRow(db, row.id, userId, {
      status: "failed",
      error: status.error ?? "The provider reported a failure",
      completed_at: new Date().toISOString(),
    });
    row.status = "failed";
    row.error = status.error ?? "The provider reported a failure";
    return row;
  }

  // completed — copy media into our own storage, then finalize.
  const stored = await copyOutputsToStorage(db, row, status.outputUrls);
  const primary = stored[0];
  await updateRow(db, row.id, userId, {
    status: "completed",
    output_url: primary?.storagePath ?? null,
    thumbnail_url:
      row.generation_type === "image" ? (primary?.storagePath ?? null) : null,
    actual_cost: row.estimated_cost,
    completed_at: new Date().toISOString(),
    error: null,
  });
  await db.from("usage_logs").insert({
    user_id: userId,
    generation_id: row.id,
    provider: row.provider,
    model: row.model,
    project_id: row.project_id,
    cost_usd: row.estimated_cost ?? 0,
  });

  const { data: fresh } = await db
    .from("generations")
    .select("*")
    .eq("id", row.id)
    .eq("user_id", userId)
    .single();
  return (fresh ?? row) as GenerationRow;
}

async function copyOutputsToStorage(
  db: Db,
  row: GenerationRow,
  urls: string[],
): Promise<Array<{ storagePath: string; mimeType: string }>> {
  const stored: Array<{ storagePath: string; mimeType: string }> = [];
  const ext = row.generation_type === "video" ? "mp4" : "png";
  const mime = row.generation_type === "video" ? "video/mp4" : "image/png";

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]!;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`Provider CDN returned ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length > MAX_COPY_BYTES) throw new Error("Output file too large");
      const contentType = res.headers.get("content-type") ?? mime;
      const storagePath = `${row.user_id}/${row.id}/${i}.${ext}`;
      const { error } = await db.storage
        .from(OUTPUTS_BUCKET)
        .upload(storagePath, buffer, { contentType, upsert: true });
      if (error) throw new Error(`Storage upload failed: ${error.message}`);
      await db.from("generation_assets").insert({
        generation_id: row.id,
        user_id: row.user_id,
        storage_path: storagePath,
        mime_type: contentType,
      });
      stored.push({ storagePath, mimeType: contentType });
    } finally {
      clearTimeout(timeout);
    }
  }
  return stored;
}

/** Replace private storage paths with short-lived signed URLs for display. */
export async function serializeGeneration(
  row: GenerationRow,
  favorites?: Set<string>,
): Promise<SerializedGeneration> {
  const db = await createServiceClient();
  async function sign(path: string | null): Promise<string | null> {
    if (!path) return null;
    if (/^https?:\/\//.test(path)) return path; // legacy / fallback URL
    const { data, error } = await db.storage
      .from(OUTPUTS_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data) return null;
    return data.signedUrl;
  }
  return {
    ...row,
    output_url: await sign(row.output_url),
    thumbnail_url: await sign(row.thumbnail_url),
    is_favorite: favorites ? favorites.has(row.id) : false,
  };
}

export async function favoriteIds(userId: string): Promise<Set<string>> {
  const db = await createServiceClient();
  const { data } = await db.from("favorites").select("generation_id").eq("user_id", userId);
  return new Set((data ?? []).map((f: { generation_id: string }) => f.generation_id));
}

export interface SerializedAsset {
  id: string;
  url: string | null;
  mimeType: string | null;
}

/** All stored output files for a generation (batch of N), newest last. */
export async function listAssets(
  userId: string,
  generationId: string,
): Promise<SerializedAsset[]> {
  const db = await createServiceClient();
  const { data: generation } = await db
    .from("generations")
    .select("id")
    .eq("id", generationId)
    .eq("user_id", userId)
    .single();
  if (!generation) throw new Error("Generation not found");
  const { data, error } = await db
    .from("generation_assets")
    .select("id,storage_path,mime_type,created_at")
    .eq("generation_id", generationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Assets query failed: ${error.message}`);
  const rows = (data ?? []) as Array<{
    id: string;
    storage_path: string;
    mime_type: string | null;
    created_at: string;
  }>;
  return Promise.all(
    rows.map(async (r) => {
      const { data: signed } = await db.storage
        .from(OUTPUTS_BUCKET)
        .createSignedUrl(r.storage_path, SIGNED_URL_TTL_SECONDS);
      return { id: r.id, url: signed?.signedUrl ?? null, mimeType: r.mime_type };
    }),
  );
}

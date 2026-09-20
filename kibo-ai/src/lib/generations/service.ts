/**
 * Generation service — orchestrates DB + provider + storage.
 * All functions scope by userId explicitly (service client bypasses RLS).
 */
import { createServiceClient } from "../supabase/server";
import { getBilling } from "../billing/ledger";
import { isAppAdmin } from "../admin";
import { getProvider, isProviderId } from "../providers";
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
  team_id: string | null;
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

async function updateRow(db: Db, id: string, patch: Partial<GenerationRow>) {
  const { data, error } = await db
    .from("generations")
    .update(patch)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`DB update failed: ${error.message}`);
  // Updates against a deleted row are otherwise reported as a successful
  // no-op by PostgREST. Detect that race before recording usage or returning
  // a now-deleted generation to the client.
  if (!data) throw httpError(404, "Generation not found");
}

export type GenerationAccess = "owner" | "member";

export interface AccessibleGeneration {
  row: GenerationRow;
  access: GenerationAccess;
  teamId: string | null;
  teamRole: string | null;
}

/**
 * Load a generation the user may see: their own, or one filed under a
 * project whose team they belong to. Null when there is no access.
 */
export async function loadGenerationForUser(
  db: Db,
  userId: string,
  id: string,
): Promise<AccessibleGeneration | null> {
  const { data } = await db.from("generations").select("*").eq("id", id).single();
  if (!data) return null;
  const row = data as GenerationRow;
  if (row.user_id === userId) return { row, access: "owner", teamId: null, teamRole: null };
  if (!row.project_id) return null;
  const { data: project } = await db
    .from("projects")
    .select("team_id")
    .eq("id", row.project_id)
    .single();
  const teamId = (project as { team_id: string | null } | null)?.team_id;
  if (!teamId) return null;
  const { data: membership } = await db
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) return null;
  return {
    row,
    access: "member",
    teamId,
    teamRole: (membership as { role: string }).role,
  };
}

export interface AccessibleProject {
  id: string;
  user_id: string;
  team_id: string | null;
}

/** Project the user can file generations under: owned or team-shared. */
export async function loadProjectForUse(
  db: Db,
  userId: string,
  projectId: string,
): Promise<AccessibleProject | null> {
  const { data } = await db
    .from("projects")
    .select("id,user_id,team_id")
    .eq("id", projectId)
    .single();
  if (!data) return null;
  const project = data as AccessibleProject;
  if (!project.team_id) return project.user_id === userId ? project : null;
  const { data: membership } = await db
    .from("team_members")
    .select("role")
    .eq("team_id", project.team_id)
    .eq("user_id", userId)
    .maybeSingle();
  // A team assignment always requires current membership, including when the
  // caller originally created the project. This prevents a former member (or
  // an owner with a stale assignment) from charging a team wallet.
  return membership ? project : null;
}

export async function createGenerationRecord(
  userId: string,
  body: CreateGenerationBody,
): Promise<GenerationRow> {
  const model = getModel(body.model);
  if (model.capabilities.generationType !== body.generationType) {
    throw new Error(`Model ${model.label} does not support ${body.generationType} generation`);
  }
  if (!isProviderId(body.provider) || model.provider !== body.provider) {
    throw new Error(`Model ${model.label} is not available through ${body.provider}`);
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

  const provider = getProvider(body.provider);

  const db = await createServiceClient();
  const admin = await isAppAdmin(userId);
  let fundingTeamId: string | null = null;
  if (body.projectId) {
    const project = await loadProjectForUse(db, userId, body.projectId);
    if (!project) throw new Error("Project not found");
    fundingTeamId = project.team_id;
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
      .or(`is_public.eq.true,user_id.eq.${userId}`)
      .maybeSingle();
    if (!template) throw new Error("Template not found");
  }

  if (!admin) await enforceSpendingLimit(db, userId, estimate.amountUsd);
  // Funding wallet: team project → team wallet, else personal credits.
  if (fundingTeamId && !admin) {
    await getBilling().checkTeamSufficient(fundingTeamId, estimate.amountUsd);
  } else {
    // Prepaid credits gate the submit; the ledger is debited at completion.
    await getBilling().checkSufficient(userId, estimate.amountUsd);
  }

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
      team_id: fundingTeamId,
      brand_id: body.brandId ?? null,
      template_id: body.templateId ?? null,
      provider: body.provider,
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
  if (error || !data) {
    // The provider already billed this request — cancel it so it cannot
    // run (and cost) with nowhere to land. Best effort: the insert error
    // is what the caller must see.
    try {
      await provider.cancelGeneration(queued.providerRequestId);
    } catch {
      // Provider cancel is best-effort; the row error below takes precedence.
    }
    throw new Error(`DB insert failed: ${error?.message ?? "unknown"}`);
  }
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
  const { data: generations, error } = await db
    .from("generations")
    .select("estimated_cost,actual_cost")
    .eq("user_id", userId)
    .gte("created_at", monthStart.toISOString())
    .in("status", ["queued", "processing", "completed"]);
  if (error) throw new Error(`Spending limit check failed: ${error.message}`);
  // Include active jobs so a user cannot queue many requests before the first
  // completed job is written to usage_logs. Completed rows use actual cost
  // where available; active rows reserve their estimate.
  const spent = ((generations ?? []) as Array<{
    estimated_cost: number | null;
    actual_cost: number | null;
  }>).reduce(
    (sum, r) => sum + Number(r.actual_cost ?? r.estimated_cost ?? 0),
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
  const accessible = await loadGenerationForUser(db, userId, generationId);
  if (!accessible) throw httpError(404, "Generation not found");
  const row = accessible.row;

  if (isTerminal(row.status) || !row.provider_request_id) return row;

  if (!isProviderId(row.provider)) throw new Error(`Unknown provider: ${row.provider}`);
  const provider = getProvider(row.provider);
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
      await updateRow(db, row.id, { status: status.status, error: null });
      row.status = status.status;
    }
    return row;
  }

  if (status.status === "cancelled") {
    await updateRow(db, row.id, {
      status: "cancelled",
      error: status.error ?? "Cancelled",
      completed_at: new Date().toISOString(),
    });
    row.status = "cancelled";
    return row;
  }

  if (status.status === "failed" || status.outputUrls.length === 0) {
    await updateRow(db, row.id, {
      status: "failed",
      error: status.error ?? "The provider reported a failure",
      completed_at: new Date().toISOString(),
    });
    row.status = "failed";
    row.error = status.error ?? "The provider reported a failure";
    return row;
  }

  // completed — copy media into our own storage, then finalize.
  // Idempotency: two concurrent polls can both observe "completed".
  // Re-read the row and bail if a sibling request already finalized it;
  // the usage log is additionally guarded by a generation_id lookup.
  const { data: latest } = await db
    .from("generations")
    .select("status")
    .eq("id", row.id)
    .single();
  if (latest && isTerminal((latest as { status: GenerationStatusValue }).status)) {
    const { data: fresh } = await db
      .from("generations")
      .select("*")
      .eq("id", row.id)
      .single();
    return (fresh ?? row) as GenerationRow;
  }
  const stored = await copyOutputsToStorage(db, row, status.outputUrls);
  const primary = stored[0];
  // Higgsfield's completion payload does not include an invoice amount. The
  // closest auditable final cost is therefore the public-price quote locked at
  // submission. Never recalculate an old job with a newer catalog rate.
  const actualCost =
    row.estimated_cost == null
      ? estimateModelCost({
          model: row.model,
          generationType: row.generation_type,
          prompt: row.prompt,
          negativePrompt: row.negative_prompt ?? undefined,
          inputAssets: row.input_assets.map((asset) => ({
            ...asset,
            role: asset.role as "start" | "end" | "reference" | "video" | "audio",
          })),
          settings: row.settings,
        }).amountUsd
      : Number(row.estimated_cost);
  await updateRow(db, row.id, {
    status: "completed",
    output_url: primary?.storagePath ?? null,
    thumbnail_url:
      row.generation_type === "image" ? (primary?.storagePath ?? null) : null,
    actual_cost: actualCost,
    completed_at: new Date().toISOString(),
    error: null,
  });
  const { data: logged } = await db
    .from("usage_logs")
    .select("id")
    .eq("generation_id", row.id)
    .maybeSingle();
  if (!logged) {
    const { error: usageError } = await db.from("usage_logs").insert({
      // Spend belongs to the generation owner, whoever polls it home.
      user_id: row.user_id,
      generation_id: row.id,
      provider: row.provider,
      model: row.model,
      project_id: row.project_id,
      cost_usd: actualCost,
    });
    if (usageError) throw new Error(`Usage log failed: ${usageError.message}`);
    // Debit the snapshotted funding wallet. Failed generations never reach
    // here, so like the provider, Kibo AI only bills completed work.
    if (row.team_id && !(await isAppAdmin(row.user_id))) {
      await getBilling().spendTeam(row.team_id, row.id, actualCost);
    } else {
      await getBilling().spend(row.user_id, row.id, actualCost);
    }
  }

  const { data: fresh } = await db
    .from("generations")
    .select("*")
    .eq("id", row.id)
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

  // Skip files a sibling finalize already stored (same deterministic path).
  const { data: existing } = await db
    .from("generation_assets")
    .select("storage_path")
    .eq("generation_id", row.id);
  const have = new Set(((existing ?? []) as Array<{ storage_path: string }>).map((a) => a.storage_path));

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]!;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const storagePath = `${row.user_id}/${row.id}/${i}.${ext}`;
      if (have.has(storagePath)) {
        stored.push({ storagePath, mimeType: mime });
        continue;
      }
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`Provider CDN returned ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length > MAX_COPY_BYTES) throw new Error("Output file too large");
      const contentType = res.headers.get("content-type") ?? mime;
      const { error } = await db.storage
        .from(OUTPUTS_BUCKET)
        .upload(storagePath, buffer, { contentType, upsert: true });
      if (error) throw new Error(`Storage upload failed: ${error.message}`);
      const { error: assetError } = await db.from("generation_assets").upsert(
        {
          generation_id: row.id,
          user_id: row.user_id,
          storage_path: storagePath,
          mime_type: contentType,
        },
        { onConflict: "generation_id,storage_path", ignoreDuplicates: true },
      );
      if (assetError) throw new Error(`Asset record failed: ${assetError.message}`);
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

/** All stored output files for a generation (batch of N), oldest first. */
export async function listAssets(
  userId: string,
  generationId: string,
): Promise<SerializedAsset[]> {
  const db = await createServiceClient();
  const accessible = await loadGenerationForUser(db, userId, generationId);
  if (!accessible) throw httpError(404, "Generation not found");
  const { data, error } = await db
    .from("generation_assets")
    .select("id,storage_path,mime_type,created_at")
    .eq("generation_id", generationId)
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

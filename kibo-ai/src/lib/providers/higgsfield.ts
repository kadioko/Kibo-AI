/**
 * Higgsfield provider — server-side only.
 *
 * Talks to the official Higgsfield API (docs.higgsfield.ai):
 *   POST /{model-endpoint}          → { request_id, status_url, cancel_url }
 *   GET  /requests/{id}/status      → { status, images?, video?, error? }
 *   POST /requests/{id}/cancel      → cancel
 * Auth: `Authorization: Key {KEY_ID}:{KEY_SECRET}`
 *
 * This module must never be imported by client components.
 */

import type {
  CostEstimate,
  CreateGenerationInput,
  GenerationProvider,
  GenerationStatusValue,
  ProviderGenerationStatus,
  ProviderModelInfo,
  QueuedGeneration,
} from "./types";

export class HiggsfieldError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(HiggsfieldError.message(status, body));
    this.name = "HiggsfieldError";
    this.status = status;
    this.body = body;
  }

  private static message(status: number, body: unknown): string {
    if (body !== null && typeof body === "object" && !Array.isArray(body)) {
      const detail = (body as Record<string, unknown>).detail;
      if (typeof detail === "string" && detail) return detail;
      const message = (body as Record<string, unknown>).message;
      if (typeof message === "string" && message) return message;
    }
    return `Higgsfield request failed (${status})`;
  }
}

export interface HiggsfieldClientOptions {
  keyId: string;
  keySecret: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

const MODEL_ENDPOINT = /^[a-z0-9][a-z0-9._/-]*$/i;

function mapStatus(raw: string): GenerationStatusValue {
  switch (raw.toLowerCase()) {
    case "completed":
      return "completed";
    case "failed":
    case "nsfw":
      return "failed";
    case "canceled":
    case "cancelled":
      return "cancelled";
    case "processing":
    case "in_progress":
    case "running":
      return "processing";
    default:
      return "queued";
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const field = record[key];
  return typeof field === "string" ? field : undefined;
}

export function createHiggsfieldProvider(options: HiggsfieldClientOptions): GenerationProvider {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const auth = `Key ${options.keyId}:${options.keySecret}`;

  async function send(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>,
  ): Promise<unknown> {
    const url = `${baseUrl}${path}`;
    const response = await fetchImpl(url, {
      method,
      headers: {
        Authorization: auth,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = text;
      }
    }
    if (!response.ok) throw new HiggsfieldError(response.status, payload);
    return payload;
  }

  return {
    id: "higgsfield",

    async estimateCost(input: CreateGenerationInput): Promise<CostEstimate> {
      // The platform exposes per-model rates in its catalog; without a live
      // pricing endpoint call, estimate locally from the model registry so the
      // UI can always show a number before submit. The registry is imported
      // lazily to keep the provider decoupled from catalog data.
      const { estimateModelCost } = await import("../models/registry");
      return estimateModelCost(input);
    },

    async createGeneration(input: CreateGenerationInput): Promise<QueuedGeneration> {
      const { endpoint, body } = await import("../models/registry").then(({ buildPlatformBody }) =>
        buildPlatformBody(input),
      );
      if (!MODEL_ENDPOINT.test(endpoint) || endpoint.includes("..")) {
        throw new HiggsfieldError(400, { detail: "Invalid model endpoint" });
      }
      const data = asRecord(await send("POST", `/${endpoint}`, body));
      const providerRequestId = stringField(data, "request_id");
      if (!providerRequestId) {
        throw new HiggsfieldError(502, { detail: "Platform response missing request_id" });
      }
      return {
        providerRequestId,
        status: mapStatus(stringField(data, "status") ?? "queued"),
        statusUrl: stringField(data, "status_url"),
        cancelUrl: stringField(data, "cancel_url"),
      };
    },

    async getGenerationStatus(providerRequestId: string): Promise<ProviderGenerationStatus> {
      if (!providerRequestId) throw new HiggsfieldError(400, { detail: "Missing request id" });
      const data = asRecord(
        await send("GET", `/requests/${encodeURIComponent(providerRequestId)}/status`),
      );
      const rawStatus = stringField(data, "status") ?? "unknown";
      const status = mapStatus(rawStatus);

      const outputUrls: string[] = [];
      if (Array.isArray(data.images)) {
        for (const item of data.images) {
          const url = asRecord(item).url;
          if (typeof url === "string") outputUrls.push(url);
        }
      }
      const videoUrl = asRecord(data.video).url;
      if (typeof videoUrl === "string") outputUrls.push(videoUrl);

      let error: string | undefined;
      if (rawStatus.toLowerCase() === "nsfw") error = "The platform flagged the result as NSFW";
      else if (status === "failed") {
        error =
          typeof data.error === "string" && data.error
            ? data.error
            : "The platform reported a failure";
      }

      return { status, outputUrls, error };
    },

    async cancelGeneration(providerRequestId: string): Promise<void> {
      if (!providerRequestId) throw new HiggsfieldError(400, { detail: "Missing request id" });
      await send("POST", `/requests/${encodeURIComponent(providerRequestId)}/cancel`);
    },

    async getModels(): Promise<ProviderModelInfo[]> {
      const { MODELS } = await import("../models/registry");
      return MODELS.filter((m) => m.provider === "higgsfield").map((m) => ({
        id: m.id,
        label: m.label,
        generationType: m.capabilities.generationType,
      }));
    },
  };
}

/** Build the server-side provider from environment. Throws if misconfigured. */
export function higgsfieldFromEnv(fetchImpl?: typeof fetch): GenerationProvider {
  const keyId = process.env.HIGGSFIELD_API_KEY_ID;
  const keySecret = process.env.HIGGSFIELD_API_KEY_SECRET;
  const baseUrl = process.env.HIGGSFIELD_API_BASE_URL ?? "https://api.higgsfield.ai";
  if (!keyId || !keySecret) {
    throw new Error("Missing HIGGSFIELD_API_KEY_ID / HIGGSFIELD_API_KEY_SECRET");
  }
  return createHiggsfieldProvider({ keyId, keySecret, baseUrl, fetchImpl });
}

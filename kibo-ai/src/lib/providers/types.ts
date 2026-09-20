/**
 * GenerationProvider — generic interface for AI media providers.
 *
 * Kibo AI talks to providers only through this interface so new providers
 * can be added without touching the frontend or API routes.
 */

export type GenerationType = "image" | "video";

/** Terminal lifecycle of a generation inside Kibo AI. */
export type GenerationStatusValue =
  | "draft"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface InputAsset {
  /** Public URL of the uploaded reference media. */
  url: string;
  /** Role the asset plays for the model (start frame, reference, …). */
  role: "start" | "end" | "reference" | "video" | "audio";
  /** MIME type, e.g. "image/png". */
  contentType?: string;
}

export interface CreateGenerationInput {
  /** Registry model id, e.g. "soul-2". The provider resolves the endpoint. */
  model: string;
  generationType: GenerationType;
  prompt: string;
  negativePrompt?: string;
  inputAssets?: InputAsset[];
  /** Validated, model-specific settings (aspect ratio, duration, …). */
  settings: Record<string, unknown>;
}

export interface CostEstimate {
  amountUsd: number;
  currency: "USD";
  /** Human-readable explanation, e.g. "5s × 1080p + audio". */
  breakdown?: string;
  /** Public catalog snapshot used for this quote. */
  pricingAsOf?: string;
  /** Clarifies that provider account discounts or later invoice adjustments may differ. */
  pricingNote?: string;
}

export interface QueuedGeneration {
  providerRequestId: string;
  status: GenerationStatusValue;
  statusUrl?: string;
  cancelUrl?: string;
}

export interface ProviderGenerationStatus {
  status: GenerationStatusValue;
  /** Finished media URLs (provider-hosted, temporary). */
  outputUrls: string[];
  error?: string;
}

export interface ProviderModelInfo {
  id: string;
  label: string;
  generationType: GenerationType;
}

export interface GenerationProvider {
  readonly id: string;

  /** Cost of a request *before* it is submitted. Never bills. */
  estimateCost(input: CreateGenerationInput): Promise<CostEstimate>;
  /** Submit a request. Returns the provider request id for polling. */
  createGeneration(input: CreateGenerationInput): Promise<QueuedGeneration>;
  /** Poll the current status of a submitted request. */
  getGenerationStatus(providerRequestId: string): Promise<ProviderGenerationStatus>;
  /** Best-effort cancel of a queued/processing request. */
  cancelGeneration(providerRequestId: string): Promise<void>;
  /** Models available through this provider. */
  getModels(): Promise<ProviderModelInfo[]>;
}

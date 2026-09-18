/**
 * Model schema — every model declares its capabilities and settings.
 * The UI renders entirely from these declarations: no per-model screens.
 */

export type GenerationType = "image" | "video";

export type MediaRole = "start" | "end" | "reference" | "video" | "audio";

export type SettingField =
  | { type: "enum"; values: readonly string[]; default: string }
  | { type: "range"; min: number; max: number; default: number; step?: number }
  | { type: "boolean"; default: boolean }
  | { type: "integer"; min: number; max: number; optional?: boolean };

export interface ModelCapabilities {
  generationType: GenerationType;
  textToVideo: boolean;
  imageToVideo: boolean;
  videoToVideo: boolean;
  /** Max reference images accepted (0 = unsupported). */
  maxReferences: number;
  aspectRatios: readonly string[];
  resolutions: readonly string[];
  /** Allowed clip lengths in seconds (empty = n/a, i.e. image model). */
  durations: readonly number[];
  audioSupport: boolean;
  negativePrompt: boolean;
  seed: boolean;
  /** Allowed outputs per request, ascending. */
  outputs: readonly number[];
}

export interface ModelEndpoints {
  /** Used when no input media is attached. */
  text?: string;
  /** Used when a start frame is attached. */
  image?: string;
  /** Used for first/last frame workflows. */
  firstLast?: string;
  /** Used for reference/video/audio-driven workflows. */
  reference?: string;
}

export type VideoPricing = {
  /** USD per second of output at the base resolution. */
  perSecondUsd: number;
  /** Multiplier per resolution id (defaults to 1). */
  resolutionMultiplier?: Record<string, number>;
  /** Extra USD per second when audio generation is enabled. */
  audioPerSecondUsd?: number;
};

export type ImagePricing = {
  /** USD per generated image. */
  perImageUsd: number;
};

export interface ModelDefinition {
  id: string;
  provider: string;
  label: string;
  capabilities: ModelCapabilities;
  /** Max attachments per role. */
  mediaRoles: Partial<Record<MediaRole, number>>;
  settings: Record<string, SettingField>;
  endpoints: ModelEndpoints;
  pricing: VideoPricing | ImagePricing;
  /**
   * How the outputs-count setting is sent to the platform, e.g. Soul's
   * integer `batch_size`. Unset = never sent (only used for estimates).
   */
  countParam?: { bodyKey: string };
  /** Short marketing line shown in the picker. */
  blurb: string;
}

export type GenerationPlane = {
  model: string;
  prompt: string;
  negativePrompt?: string;
  media: Partial<Record<MediaRole, Array<{ url: string }>>>;
  settings: Record<string, unknown>;
};

/**
 * Kibo AI model registry — the single source of truth for models.
 *
 * Pricing reconciled 2026-09-18 against the public Higgsfield API catalog
 * (higgsfield.ai/higgsfield-api) and docs.higgsfield.ai model pages.
 * The API bills list rates in USD; account discounts (15–50%) lower the real
 * charge, so estimates use the STANDARD rate and are conservative by design.
 *
 * Verified = endpoint + params + price seen in official docs.
 * "verify"  = carried over, reconcile in console.higgsfield.ai before relying
 *             on it for billing-sensitive flows.
 */
import type { CostEstimate, CreateGenerationInput } from "../providers/types";
import type { ModelDefinition, ModelEndpoints } from "./types";

const RATIOS_IMAGE = ["1:1", "3:4", "4:3", "9:16", "16:9"] as const;
const RATIOS_VIDEO = ["16:9", "9:16", "1:1", "4:3", "3:4"] as const;

function imageModel(
  def: Omit<ModelDefinition, "capabilities"> & {
    capabilities?: Partial<ModelDefinition["capabilities"]>;
  },
): ModelDefinition {
  return {
    ...def,
    capabilities: {
      generationType: "image",
      textToVideo: false,
      imageToVideo: false,
      videoToVideo: false,
      maxReferences: 0,
      aspectRatios: RATIOS_IMAGE,
      resolutions: ["720p", "1080p"],
      durations: [],
      audioSupport: false,
      negativePrompt: false,
      seed: true,
      outputs: [1],
      ...def.capabilities,
    },
  };
}

function videoModel(
  def: Omit<ModelDefinition, "capabilities"> & {
    capabilities?: Partial<ModelDefinition["capabilities"]>;
  },
): ModelDefinition {
  return {
    ...def,
    capabilities: {
      generationType: "video",
      textToVideo: true,
      imageToVideo: false,
      videoToVideo: false,
      maxReferences: 0,
      aspectRatios: RATIOS_VIDEO,
      resolutions: ["720p", "1080p"],
      durations: [5, 10],
      audioSupport: false,
      negativePrompt: false,
      seed: false,
      outputs: [1],
      ...def.capabilities,
    },
  };
}

export const MODELS: readonly ModelDefinition[] = [
  // Verified: docs.higgsfield.ai/docs/models/soul-2/generate.md —
  // endpoint, aspect_ratio, resolution, integer batch_size, enhance_prompt,
  // seed 1–1000000, $0.0032/image list rate. No negative_prompt param.
  imageModel({
    id: "soul-2",
    provider: "higgsfield",
    label: "Soul 2",
    blurb: "Higgsfield's flagship photoreal image model",
    mediaRoles: {},
    settings: {
      aspectRatio: {
        type: "enum",
        values: ["9:16", "16:9", "4:3", "3:4", "1:1", "2:3", "3:2"],
        default: "4:3",
      },
      resolution: { type: "enum", values: ["720p", "1080p"], default: "720p" },
      batchSize: { type: "enum", values: ["1", "4"], default: "1" },
      enhancePrompt: { type: "boolean", default: true },
      seed: { type: "integer", min: 1, max: 1000000, optional: true },
    },
    endpoints: { text: "higgsfield-ai/soul/v2/standard" },
    countParam: { bodyKey: "batch_size" },
    pricing: { perImageUsd: 0.0032 },
    capabilities: { outputs: [1, 4], seed: true },
  }),
  // Verified: docs.higgsfield.ai/docs/models/soul-cinema/generate.md —
  // same schema as Soul 2. Price uses the Soul Standard list rate ($0.0938);
  // verify in console (verify).
  imageModel({
    id: "soul-cinema",
    provider: "higgsfield",
    label: "Soul Cinema",
    blurb: "Cinematic stills with filmic light",
    mediaRoles: {},
    settings: {
      aspectRatio: {
        type: "enum",
        values: ["9:16", "16:9", "4:3", "3:4", "1:1", "2:3", "3:2"],
        default: "16:9",
      },
      resolution: { type: "enum", values: ["720p", "1080p"], default: "720p" },
      batchSize: { type: "enum", values: ["1", "4"], default: "1" },
      enhancePrompt: { type: "boolean", default: true },
      seed: { type: "integer", min: 1, max: 1000000, optional: true },
    },
    endpoints: { text: "higgsfield-ai/soul/cinema" },
    countParam: { bodyKey: "batch_size" },
    pricing: { perImageUsd: 0.0938 },
    capabilities: { outputs: [1, 4], seed: true },
  }),
  // Endpoints + price unverified (verify).
  imageModel({
    id: "flux",
    provider: "higgsfield",
    label: "Flux",
    blurb: "Open-weight quality, fast text-to-image",
    mediaRoles: { reference: 1 },
    settings: {
      aspectRatio: { type: "enum", values: RATIOS_IMAGE, default: "1:1" },
      numImages: { type: "range", min: 1, max: 4, default: 1 },
    },
    endpoints: {
      text: "flux/text-to-image",
      reference: "flux/reference-to-image",
    },
    pricing: { perImageUsd: 0.04 },
    capabilities: { maxReferences: 1, outputs: [1, 2, 3, 4] },
  }),
  // Endpoints + price unverified (verify).
  imageModel({
    id: "ideogram",
    provider: "higgsfield",
    label: "Ideogram",
    blurb: "Best-in-class typography and posters",
    mediaRoles: { reference: 1 },
    settings: {
      aspectRatio: { type: "enum", values: RATIOS_IMAGE, default: "1:1" },
      resolution: { type: "enum", values: ["720p", "1080p"], default: "720p" },
    },
    endpoints: {
      text: "ideogram/text-to-image",
      reference: "ideogram/reference-to-image",
    },
    pricing: { perImageUsd: 0.06 },
    capabilities: { maxReferences: 1 },
  }),
  // Verified: docs.higgsfield.ai/docs/models/recraft-v4-1-pro/generate.md —
  // endpoint recraft/v4.1/pro/text-to-image, fixed 2k resolution, aspect
  // allow-list, output_format, colors/background (not yet exposed in UI).
  // Price unverified (verify). No negative_prompt param.
  imageModel({
    id: "recraft",
    provider: "higgsfield",
    label: "Recraft",
    blurb: "Design-forward 2K imagery and brand art",
    mediaRoles: {},
    settings: {
      aspectRatio: {
        type: "enum",
        values: [
          "1:1", "2:1", "1:2", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5",
          "6:10", "14:10", "10:14", "16:9", "9:16",
        ],
        default: "1:1",
      },
      resolution: { type: "enum", values: ["2k"], default: "2k" },
      outputFormat: { type: "enum", values: ["png", "jpg", "webp"], default: "jpg" },
    },
    endpoints: { text: "recraft/v4.1/pro/text-to-image" },
    pricing: { perImageUsd: 0.06 },
  }),
  // Endpoints + price unverified (verify).
  imageModel({
    id: "qwen-image",
    provider: "higgsfield",
    label: "Qwen Image",
    blurb: "Strong instruction following and edits",
    mediaRoles: { reference: 4 },
    settings: {
      aspectRatio: { type: "enum", values: RATIOS_IMAGE, default: "1:1" },
      resolution: { type: "enum", values: ["720p", "1080p", "2K"], default: "1080p" },
    },
    endpoints: {
      text: "qwen/image/text-to-image",
      reference: "qwen/image/reference-to-image",
    },
    pricing: { perImageUsd: 0.05 },
    capabilities: { maxReferences: 4 },
  }),
  // Price uses the public Seedance 2.5 standard list rate ($0.1234/s);
  // token-metered 1080p lands in the same band via the multiplier.
  // Audio delta unverified (verify).
  videoModel({
    id: "seedance-2.5",
    provider: "higgsfield",
    label: "Seedance 2.5",
    blurb: "Frontier motion with native audio",
    mediaRoles: { start: 1, end: 1, reference: 4, video: 2, audio: 1 },
    settings: {
      aspectRatio: { type: "enum", values: RATIOS_VIDEO, default: "16:9" },
      resolution: { type: "enum", values: ["720p", "1080p"], default: "720p" },
      duration: { type: "enum", values: ["5", "10"], default: "5" },
      generateAudio: { type: "boolean", default: true },
    },
    endpoints: {
      text: "bytedance/seedance-2.5/text-to-video",
      image: "bytedance/seedance-2.5/image-to-video",
      reference: "bytedance/seedance-2.5/reference-to-video",
    },
    pricing: {
      perSecondUsd: 0.1234,
      resolutionMultiplier: { "720p": 1, "1080p": 1.8 },
      audioPerSecondUsd: 0.03,
    },
    capabilities: {
      imageToVideo: true,
      videoToVideo: true,
      maxReferences: 4,
      durations: [5, 10],
      audioSupport: true,
      seed: true,
    },
  }),
  // Endpoints + price unverified (verify); Fast tier should sit under 2.0 std.
  videoModel({
    id: "seedance-2.0-fast",
    provider: "higgsfield",
    label: "Seedance 2.0 Fast",
    blurb: "Fast drafts with native audio",
    mediaRoles: { start: 1, end: 1, reference: 4, video: 2, audio: 1 },
    settings: {
      aspectRatio: { type: "enum", values: RATIOS_VIDEO, default: "16:9" },
      resolution: { type: "enum", values: ["720p", "1080p"], default: "720p" },
      duration: { type: "enum", values: ["5", "10"], default: "5" },
      generateAudio: { type: "boolean", default: true },
    },
    endpoints: {
      text: "bytedance/seedance-2.0/fast/text-to-video",
      image: "bytedance/seedance-2.0/fast/image-to-video",
      reference: "bytedance/seedance-2.0/fast/reference-to-video",
    },
    pricing: {
      perSecondUsd: 0.0985,
      resolutionMultiplier: { "720p": 1, "1080p": 1.8 },
      audioPerSecondUsd: 0.02,
    },
    capabilities: {
      imageToVideo: true,
      videoToVideo: true,
      maxReferences: 4,
      durations: [5, 10],
      audioSupport: true,
    },
  }),
  // Standard list rate $0.084/s (50%-off promo rate is $0.042).
  // Aspect allow-list is 16:9/9:16/1:1 — sending anything else 400s.
  // Turbo params page unverified (verify).
  videoModel({
    id: "kling-3-turbo",
    provider: "higgsfield",
    label: "Kling 3 Turbo",
    blurb: "Fast, high-fidelity short clips",
    mediaRoles: { start: 1 },
    settings: {
      aspectRatio: { type: "enum", values: ["16:9", "9:16", "1:1"], default: "16:9" },
      resolution: { type: "enum", values: ["720p", "1080p"], default: "720p" },
      duration: { type: "enum", values: ["5", "10"], default: "5" },
    },
    endpoints: {
      text: "kling-video/v3.0-turbo/text-to-video",
      image: "kling-video/v3.0-turbo/image-to-video",
    },
    pricing: { perSecondUsd: 0.084 },
    capabilities: { imageToVideo: true, durations: [5, 10] },
  }),
  // Standard list rate $0.084/s. `sound` is sent as "on"/"off" (docs).
  // Std params page unverified beyond the shared Kling contract (verify).
  videoModel({
    id: "kling-3-std",
    provider: "higgsfield",
    label: "Kling 3 Standard",
    blurb: "Balanced quality with sound and multi-shot",
    mediaRoles: { start: 1, end: 1 },
    settings: {
      aspectRatio: { type: "enum", values: ["16:9", "9:16", "1:1"], default: "16:9" },
      duration: { type: "enum", values: ["5", "10"], default: "5" },
      sound: { type: "boolean", default: false },
      cfgScale: { type: "range", min: 0, max: 1, default: 0.5, step: 0.1 },
      multiShots: { type: "boolean", default: false },
    },
    endpoints: {
      text: "kling-video/v3.0/std/text-to-video",
      image: "kling-video/v3.0/std/image-to-video",
    },
    pricing: {
      perSecondUsd: 0.084,
      audioPerSecondUsd: 0.02,
    },
    capabilities: { imageToVideo: true, durations: [5, 10], audioSupport: true },
  }),
  // Verified: docs.higgsfield.ai/docs/models/kling-3/pro-text-to-video.md —
  // endpoint, duration 3–15s, sound on/off, cfg_scale 0–1, multi_shots,
  // aspect 16:9/9:16/1:1. Pro price unverified (verify).
  videoModel({
    id: "kling-3-pro",
    provider: "higgsfield",
    label: "Kling 3 Pro",
    blurb: "Top-tier realism for hero shots",
    mediaRoles: { start: 1, end: 1 },
    settings: {
      aspectRatio: { type: "enum", values: ["16:9", "9:16", "1:1"], default: "16:9" },
      duration: { type: "enum", values: ["3", "5", "10", "15"], default: "5" },
      sound: { type: "boolean", default: true },
      cfgScale: { type: "range", min: 0, max: 1, default: 0.5, step: 0.05 },
      multiShots: { type: "boolean", default: false },
    },
    endpoints: {
      text: "kling-video/v3.0/pro/text-to-video",
      image: "kling-video/v3.0/pro/image-to-video",
    },
    pricing: {
      perSecondUsd: 0.28,
      audioPerSecondUsd: 0.05,
    },
    capabilities: { imageToVideo: true, durations: [3, 5, 10, 15], audioSupport: true },
  }),
  // Wan 3.0 standard list rate $0.05/s. Endpoints unverified (verify).
  videoModel({
    id: "wan-3",
    provider: "higgsfield",
    label: "Wan 3",
    blurb: "Open video model with solid motion",
    mediaRoles: { start: 1, end: 1 },
    settings: {
      aspectRatio: { type: "enum", values: RATIOS_VIDEO, default: "16:9" },
      resolution: { type: "enum", values: ["720p", "1080p"], default: "720p" },
      duration: { type: "enum", values: ["5", "10"], default: "5" },
    },
    endpoints: {
      text: "wan/v3/text-to-video",
      image: "wan/v3/image-to-video",
      firstLast: "wan/v3/first-last-frame-to-video",
    },
    pricing: { perSecondUsd: 0.05 },
    capabilities: { imageToVideo: true, durations: [5, 10] },
  }),
  // Endpoints + params + price unverified (verify).
  videoModel({
    id: "ltx-2.5-pro",
    provider: "higgsfield",
    label: "LTX 2.5 Pro",
    blurb: "Precise control with audio option",
    mediaRoles: { start: 1 },
    settings: {
      aspectRatio: { type: "enum", values: RATIOS_VIDEO, default: "16:9" },
      resolution: { type: "enum", values: ["720p", "1080p"], default: "720p" },
      duration: { type: "range", min: 2, max: 10, default: 5 },
      generateAudio: { type: "boolean", default: false },
    },
    endpoints: {
      text: "ltx/2.5-pro/text-to-video",
      image: "ltx/2.5-pro/image-to-video",
    },
    pricing: {
      perSecondUsd: 0.08,
      audioPerSecondUsd: 0.02,
    },
    capabilities: { imageToVideo: true, durations: [2, 3, 4, 5, 6, 7, 8, 9, 10], audioSupport: true },
  }),
  // Endpoints + params + price unverified (verify).
  videoModel({
    id: "minimax-hailuo",
    provider: "higgsfield",
    label: "MiniMax Hailuo",
    blurb: "Expressive characters and motion",
    mediaRoles: { start: 1 },
    settings: {
      aspectRatio: { type: "enum", values: RATIOS_VIDEO, default: "16:9" },
      duration: { type: "enum", values: ["6", "10"], default: "6" },
    },
    endpoints: {
      text: "minimax/hailuo/text-to-video",
      image: "minimax/hailuo/image-to-video",
    },
    pricing: { perSecondUsd: 0.07 },
    capabilities: { imageToVideo: true, durations: [6, 10] },
  }),
  // Endpoints + params + price unverified (verify).
  videoModel({
    id: "pixverse",
    provider: "higgsfield",
    label: "PixVerse",
    blurb: "Playful effects and transitions",
    mediaRoles: { start: 1 },
    settings: {
      aspectRatio: { type: "enum", values: RATIOS_VIDEO, default: "16:9" },
      duration: { type: "enum", values: ["5", "8"], default: "5" },
      generateAudio: { type: "boolean", default: false },
    },
    endpoints: {
      text: "pixverse/text-to-video",
      image: "pixverse/image-to-video",
    },
    pricing: { perSecondUsd: 0.06, audioPerSecondUsd: 0.02 },
    capabilities: { imageToVideo: true, durations: [5, 8], audioSupport: true },
  }),
  // Endpoints + params + price unverified (verify).
  videoModel({
    id: "grok-imagine-video",
    provider: "higgsfield",
    label: "Grok Imagine Video",
    blurb: "Fast video drafts from xAI",
    mediaRoles: { start: 1 },
    settings: {
      aspectRatio: { type: "enum", values: RATIOS_VIDEO, default: "16:9" },
      duration: { type: "enum", values: ["5", "10"], default: "5" },
      generateAudio: { type: "boolean", default: false },
    },
    endpoints: {
      text: "grok/imagine-video/text-to-video",
      image: "grok/imagine-video/image-to-video",
    },
    pricing: { perSecondUsd: 0.05, audioPerSecondUsd: 0.01 },
    capabilities: { imageToVideo: true, durations: [5, 10], audioSupport: true },
  }),
];

export function getModel(id: string): ModelDefinition {
  const model = MODELS.find((m) => m.id === id);
  if (!model) throw new Error(`Unknown model: ${id}`);
  return model;
}

export function modelsFor(type: "image" | "video"): ModelDefinition[] {
  return MODELS.filter((m) => m.capabilities.generationType === type);
}

/** Fill missing settings with catalog defaults; drop unknown keys. */
export function parseSettings(
  model: ModelDefinition,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const parsed: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(model.settings)) {
    const value = raw[key];
    if (field.type === "enum") {
      parsed[key] = typeof value === "string" && field.values.includes(value) ? value : field.default;
    } else if (field.type === "range") {
      const num = typeof value === "number" ? value : Number(value);
      parsed[key] =
        Number.isFinite(num) && num >= field.min && num <= field.max ? num : field.default;
    } else if (field.type === "integer") {
      if (value === undefined || value === null || value === "") {
        if (field.optional) continue; // omit → platform picks (e.g. random seed)
        parsed[key] = field.min;
        continue;
      }
      const num = typeof value === "number" ? value : Number(value);
      if (Number.isInteger(num) && num >= field.min && num <= field.max) {
        parsed[key] = num;
      } else if (!field.optional) {
        parsed[key] = field.min;
      }
    } else {
      parsed[key] = value === true;
    }
  }
  return parsed;
}

function urlsOf(
  input: CreateGenerationInput,
  role: "start" | "end" | "reference" | "video" | "audio",
): string[] {
  return (input.inputAssets ?? []).filter((a) => a.role === role).map((a) => a.url);
}

/**
 * Resolve the provider endpoint + request body for a generation.
 * Picks text/image/reference variants based on attached media.
 */
export function buildPlatformBody(input: CreateGenerationInput): {
  endpoint: string;
  body: Record<string, unknown>;
} {
  const model = getModel(input.model);
  const endpoints: ModelEndpoints = model.endpoints;
  const settings = parseSettings(model, input.settings);

  const start = urlsOf(input, "start")[0];
  const end = urlsOf(input, "end")[0];
  const refs = urlsOf(input, "reference");
  const videos = urlsOf(input, "video");
  const audios = urlsOf(input, "audio");

  const body: Record<string, unknown> = { prompt: input.prompt };
  // Only models that document negative_prompt receive it — the platform
  // rejects unknown fields on strict endpoints. No verified model supports
  // it yet, so the field stays hidden in the UI until one does.
  if (input.negativePrompt && model.capabilities.negativePrompt) {
    body.negative_prompt = input.negativePrompt;
  }
  if (typeof settings.aspectRatio === "string") body.aspect_ratio = settings.aspectRatio;
  if (typeof settings.resolution === "string") body.resolution = settings.resolution;
  if (settings.duration !== undefined) body.duration = Number(settings.duration);
  for (const [key, value] of Object.entries(settings)) {
    if (value === undefined) continue;
    if (["aspectRatio", "resolution", "duration", "batchSize", "numImages"].includes(key)) continue;
    // Kling's contract takes sound as "on"/"off", not boolean.
    if (key === "sound") {
      body.sound = value === true ? "on" : "off";
      continue;
    }
    body[toSnake(key)] = value;
  }
  // Outputs count: sent only when the model declares how (e.g. Soul's
  // integer batch_size). Otherwise it prices the estimate but is not sent.
  if (model.countParam) {
    const n = countOutputs(model, settings);
    if (Number.isFinite(n)) body[model.countParam.bodyKey] = n;
  }

  if (endpoints.firstLast && (start || end)) {
    return {
      endpoint: endpoints.firstLast,
      body: {
        ...body,
        ...(start ? { first_frame_url: start } : {}),
        ...(end ? { last_frame_url: end } : {}),
      },
    };
  }
  if (endpoints.image && start) {
    return {
      endpoint: endpoints.image,
      body: { ...body, image_url: start, ...(end ? { last_image_url: end } : {}) },
    };
  }
  if (endpoints.reference && (refs.length > 0 || videos.length > 0 || audios.length > 0)) {
    return {
      endpoint: endpoints.reference,
      body: {
        ...body,
        ...(refs.length > 0 ? { image_urls: refs } : {}),
        ...(videos.length > 0 ? { video_urls: videos } : {}),
        ...(audios.length > 0 ? { audio_urls: audios } : {}),
      },
    };
  }
  if (endpoints.text) {
    return {
      endpoint: endpoints.text,
      body: refs.length > 0 ? { ...body, image_urls: refs } : body,
    };
  }
  const fallback = endpoints.image ?? endpoints.reference ?? endpoints.firstLast;
  if (!fallback) throw new Error(`Model ${model.id} has no platform endpoint`);
  return { endpoint: fallback, body };
}

/** Find a model by any of its platform endpoints. */
export function getModelByEndpoint(endpoint: string): ModelDefinition {
  const model = MODELS.find((m) =>
    Object.values(m.endpoints).some((e) => e === endpoint),
  );
  if (!model) throw new Error(`Unknown endpoint: ${endpoint}`);
  return model;
}

/** Pre-submit cost estimate in USD. */
export function estimateModelCost(input: CreateGenerationInput): CostEstimate {
  const model = getModel(input.model);
  const settings = parseSettings(model, input.settings);

  if (model.capabilities.generationType === "image") {
    const perImage = (model.pricing as { perImageUsd: number }).perImageUsd;
    const outputs = countOutputs(model, settings);
    const amount = round2(perImage * outputs);
    return {
      amountUsd: amount,
      currency: "USD",
      breakdown: `${outputs} image${outputs > 1 ? "s" : ""} × $${perImage.toFixed(2)}`,
    };
  }

  const pricing = model.pricing as {
    perSecondUsd: number;
    resolutionMultiplier?: Record<string, number>;
    audioPerSecondUsd?: number;
  };
  const duration = Number(settings.duration ?? model.capabilities.durations[0] ?? 5);
  const resolution = typeof settings.resolution === "string" ? settings.resolution : "720p";
  const mult = pricing.resolutionMultiplier?.[resolution] ?? 1;
  const audioOn = audioEnabled(settings);
  const audioRate = audioOn ? (pricing.audioPerSecondUsd ?? 0) : 0;
  const amount = round2(duration * (pricing.perSecondUsd * mult + audioRate));
  return {
    amountUsd: amount,
    currency: "USD",
    breakdown: `${duration}s × $${(pricing.perSecondUsd * mult + audioRate).toFixed(3)}/s${audioOn ? " (incl. audio)" : ""}`,
  };
}

function countOutputs(model: ModelDefinition, settings: Record<string, unknown>): number {
  for (const key of ["numImages", "batchSize"]) {
    if (model.settings[key]) {
      const n = Number(settings[key]);
      if (Number.isFinite(n) && n >= 1) return Math.floor(n);
    }
  }
  return 1;
}

function audioEnabled(settings: Record<string, unknown>): boolean {
  return (
    settings.generateAudio === true || settings.sound === true || settings.keepOriginalSound === true
  );
}

function toSnake(key: string): string {
  return key.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

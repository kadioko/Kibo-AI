import { z } from "zod";

const mediaRole = z.enum(["start", "end", "reference", "video", "audio"]);

export const inputAssetSchema = z.object({
  url: z.string().url().max(2048),
  role: mediaRole,
  contentType: z.string().max(128).optional(),
});

export const createGenerationSchema = z.object({
  provider: z.enum(["higgsfield", "mock"]).default("higgsfield"),
  model: z.string().min(1).max(128),
  generationType: z.enum(["image", "video"]),
  prompt: z.string().trim().min(1).max(5000),
  negativePrompt: z.string().trim().max(2000).optional(),
  projectId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  inputAssets: z.array(inputAssetSchema).max(15).default([]),
  settings: z.record(z.string(), z.unknown()).default({}),
});

export const estimateSchema = createGenerationSchema.omit({
  projectId: true,
  brandId: true,
  templateId: true,
});

export const listQuerySchema = z.object({
  type: z.enum(["all", "image", "video", "favorites"]).default("all"),
  status: z
    .enum(["draft", "queued", "processing", "completed", "failed", "cancelled", "all"])
    .default("all"),
  model: z.string().max(128).optional(),
  projectId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
});

export type CreateGenerationBody = z.infer<typeof createGenerationSchema>;

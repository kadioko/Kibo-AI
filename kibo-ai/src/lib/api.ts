export interface ApiGeneration {
  id: string;
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
  status: "draft" | "queued" | "processing" | "completed" | "failed" | "cancelled";
  error: string | null;
  output_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
  completed_at: string | null;
  is_favorite: boolean;
}

export interface ApiModel {
  id: string;
  label: string;
  blurb: string;
  generationType: "image" | "video";
  capabilities: {
    generationType: "image" | "video";
    textToVideo: boolean;
    imageToVideo: boolean;
    videoToVideo: boolean;
    maxReferences: number;
    aspectRatios: readonly string[];
    resolutions: readonly string[];
    durations: readonly number[];
    audioSupport: boolean;
    negativePrompt: boolean;
    seed: boolean;
    outputs: readonly number[];
  };
  mediaRoles: Partial<Record<string, number>>;
  settings: Record<
    string,
    | { type: "enum"; values: readonly string[]; default: string }
    | { type: "range"; min: number; max: number; default: number; step?: number }
    | { type: "boolean"; default: boolean }
    | { type: "integer"; min: number; max: number; optional?: boolean }
  >;
}

export interface ApiProject {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface ApiBrand {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
  logo_url: string | null;
  colors: string[];
  industry: string | null;
  target_audience: string | null;
  visual_style: string | null;
  ad_tone: string | null;
  default_cta: string | null;
  created_at: string;
}

export interface ApiTemplate {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  prompt_structure: string;
  aspect_ratio: string | null;
  recommended_models: string[];
  duration_seconds: number | null;
  is_public: boolean;
  created_at: string;
}

/** Compose brand context into a prompt. Shown as preview; stored combined. */
export function applyBrand(prompt: string, brand: ApiBrand): string {
  const parts: string[] = [];
  if (brand.visual_style) parts.push(`Visual style: ${brand.visual_style}`);
  if (brand.ad_tone) parts.push(`Tone: ${brand.ad_tone}`);
  if (brand.target_audience) parts.push(`Audience: ${brand.target_audience}`);
  if (brand.industry) parts.push(`Industry: ${brand.industry}`);
  if (brand.default_cta) parts.push(`Call to action: ${brand.default_cta}`);
  if (parts.length === 0) return prompt;
  return `[Brand: ${brand.name}. ${parts.join(". ")}]\n\n${prompt}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

export const api = {
  models: () => request<{ models: ApiModel[] }>("/api/models"),
  estimate: (body: unknown) =>
    request<{ estimate: { amountUsd: number; currency: string; breakdown?: string } }>(
      "/api/generations/estimate",
      { method: "POST", body: JSON.stringify(body) },
    ),
  createGeneration: (body: unknown) =>
    request<{ generation: ApiGeneration }>("/api/generations", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listGenerations: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<{ generations: ApiGeneration[]; nextCursor: string | null }>(
      `/api/generations${qs ? `?${qs}` : ""}`,
    );
  },
  getGeneration: (id: string) =>
    request<{ generation: ApiGeneration }>(`/api/generations/${id}`),
  getAssets: (id: string) =>
    request<{ assets: Array<{ id: string; url: string | null; mimeType: string | null }> }>(
      `/api/generations/${id}/assets`,
    ),
  deleteGeneration: (id: string) =>
    request<{ ok: true }>(`/api/generations/${id}`, { method: "DELETE" }),
  toggleFavorite: (id: string) =>
    request<{ is_favorite: boolean }>(`/api/generations/${id}/favorite`, { method: "POST" }),
  requestUpload: (contentType: string, fileName: string) =>
    request<{ path: string; signedUrl: string; token: string; publicUrl: string; maxBytes: number }>(
      "/api/uploads",
      { method: "POST", body: JSON.stringify({ contentType, fileName }) },
    ),
  projects: () => request<{ projects: ApiProject[] }>("/api/projects"),
  createProject: (name: string, description?: string) =>
    request<{ project: ApiProject }>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    }),
  renameProject: (id: string, name: string) =>
    request<{ project: ApiProject }>(`/api/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  deleteProject: (id: string) =>
    request<{ ok: true }>(`/api/projects/${id}`, { method: "DELETE" }),
  stats: () =>
    request<{
      stats: {
        generationsMonth: number;
        images: number;
        videos: number;
        spend: number;
        active: number;
      };
    }>("/api/stats"),
  usage: (days = 30) =>
    request<{
      usage: {
        totalSpend: number;
        generations: number;
        monthSpend: number;
        monthlyLimit: number | null;
        byModel: Array<{ model: string; spend: number; count: number }>;
        byDay: Array<{ day: string; spend: number; count: number }>;
        byProject: Array<{
          projectId: string;
          projectName: string;
          spend: number;
          count: number;
        }>;
      };
    }>(`/api/usage?days=${days}`),
  brands: () => request<{ brands: ApiBrand[] }>("/api/brands"),
  createBrand: (body: Record<string, unknown>) =>
    request<{ brand: ApiBrand }>("/api/brands", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateBrand: (id: string, body: Record<string, unknown>) =>
    request<{ brand: ApiBrand }>(`/api/brands/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteBrand: (id: string) => request<{ ok: true }>(`/api/brands/${id}`, { method: "DELETE" }),
  templates: () => request<{ templates: ApiTemplate[] }>("/api/templates"),
  getTemplate: (id: string) => request<{ template: ApiTemplate }>(`/api/templates/${id}`),
  createTemplate: (body: Record<string, unknown>) =>
    request<{ template: ApiTemplate }>("/api/templates", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteTemplate: (id: string) =>
    request<{ ok: true }>(`/api/templates/${id}`, { method: "DELETE" }),
  spendingLimit: () => request<{ limit: number | null }>("/api/limits"),
  setSpendingLimit: (monthlyLimitUsd: number | null) =>
    request<{ limit: number | null }>("/api/limits", {
      method: "PUT",
      body: JSON.stringify({ monthlyLimitUsd }),
    }),
};

export async function uploadFile(file: File): Promise<string> {
  const { signedUrl, publicUrl, maxBytes } = await api.requestUpload(file.type, file.name);
  if (file.size > maxBytes) throw new Error("File is too large (max 100 MB)");
  // The token is embedded in the signed URL — plain PUT with content type.
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!res.ok) throw new Error("Upload failed");
  return publicUrl;
}

export function formatUsd(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `$${Number(n).toFixed(2)}`;
}

export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, applyBrand, formatUsd, uploadFile, type ApiBrand, type ApiGeneration, type ApiModel, type ApiProject } from "@/lib/api";

type Role = "start" | "end" | "reference" | "video" | "audio";

const ROLE_LABEL: Record<Role, string> = {
  start: "Start frame",
  end: "End frame",
  reference: "Reference",
  video: "Video",
  audio: "Audio",
};

const ACCEPT: Record<Role, string> = {
  start: "image/jpeg,image/png,image/webp,image/gif",
  end: "image/jpeg,image/png,image/webp,image/gif",
  reference: "image/jpeg,image/png,image/webp,image/gif",
  video: "video/mp4",
  audio: "audio/wav,audio/x-wav,audio/mpeg",
};

/** Stop auto-polling a single generation after this long (it still lands). */
const POLL_DEADLINE_MS = 10 * 60_000;

/** Drop a previously injected brand block so reuse edits clean words. */
function stripBrandBlock(prompt: string): string {
  return prompt.replace(/^\[Brand:[^\]]*\]\s*\n\n/, "");
}

function CreateStudio() {
  const searchParams = useSearchParams();
  const [models, setModels] = useState<ApiModel[]>([]);
  const [type, setType] = useState<"image" | "video">("image");
  const [modelId, setModelId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [settings, setSettings] = useState<Record<string, Record<string, unknown>>>({});
  const [assets, setAssets] = useState<Array<{ url: string; role: Role }>>([]);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [projectId, setProjectId] = useState("");
  const [brands, setBrands] = useState<ApiBrand[]>([]);
  const [brandId, setBrandId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [estimate, setEstimate] = useState<{ amountUsd: number; breakdown?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<ApiGeneration | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // React StrictMode (dev) mounts, unmounts and remounts: without this guard
  // the ?regenerate= auto-submit would bill twice.
  const initRan = useRef(false);

  const model = useMemo(() => models.find((m) => m.id === modelId), [models, modelId]);
  const typeModels = useMemo(() => models.filter((m) => m.generationType === type), [models, type]);
  const values = settings[modelId] ?? {};
  const brand = useMemo(() => brands.find((b) => b.id === brandId), [brands, brandId]);
  /** Prompt actually sent: user words wrapped with the brand's context. */
  const composedPrompt = useMemo(
    () => (brand && prompt.trim() ? applyBrand(prompt.trim(), brand) : prompt),
    [prompt, brand],
  );

  const stopPolling = useCallback(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = null;
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  // Initial data + reuse / regenerate / template / model preselect.
  // submitAndWatch is invoked from .then continuations (async context),
  // never synchronously in the effect body.
  useEffect(() => {
    if (initRan.current) return;
    initRan.current = true;
    Promise.all([api.models(), api.projects(), api.brands()])
      .then(async ([m, p, b]) => {
        setModels(m.models);
        setProjects(p.projects);
        setBrands(b.brands);
        const reuseId = searchParams.get("reuse");
        const regenId = searchParams.get("regenerate");
        const templateParam = searchParams.get("template");
        const presetModel = searchParams.get("model");
        const sourceId = regenId ?? reuseId;
        if (sourceId) {
          try {
            const { generation } = await api.getGeneration(sourceId);
            setType(generation.generation_type);
            setModelId(generation.model);
            setPrompt(stripBrandBlock(generation.prompt));
            setNegativePrompt(generation.negative_prompt ?? "");
            setSettings((s) => ({ ...s, [generation.model]: generation.settings }));
            setProjectId(generation.project_id ?? "");
            if (generation.brand_id) setBrandId(generation.brand_id);
            if (generation.template_id) {
              setTemplateId(generation.template_id);
              void api.getTemplate(generation.template_id).then((r) => setTemplateName(r.template.name)).catch(() => {});
            }
            if (regenId) {
              const entry = m.models.find((x) => x.id === generation.model);
              if (entry) {
                await submitAndWatch({
                  model: entry,
                  generationType: generation.generation_type,
                  prompt: generation.prompt,
                  negativePrompt: generation.negative_prompt ?? undefined,
                  projectId: generation.project_id ?? undefined,
                  brandId: generation.brand_id ?? undefined,
                  templateId: generation.template_id ?? undefined,
                  inputAssets: generation.input_assets.map((a) => ({
                    url: a.url,
                    role: a.role as Role,
                  })),
                  settings: generation.settings,
                });
              }
            }
          } catch {
            // Fall through to defaults.
          }
        } else if (templateParam) {
          try {
            const { template } = await api.getTemplate(templateParam);
            setTemplateId(template.id);
            setTemplateName(template.name);
            setPrompt(template.prompt_structure);
            const recommended = template.recommended_models.find((id) =>
              m.models.some((x) => x.id === id),
            );
            const entry = m.models.find((x) => x.id === recommended) ?? m.models[0];
            if (entry) {
              setType(entry.generationType);
              setModelId(entry.id);
              setSettings((s) => {
                const next = { ...(s[entry.id] ?? {}) };
                if (template.aspect_ratio && entry.settings.aspectRatio?.type === "enum") {
                  if (entry.settings.aspectRatio.values.includes(template.aspect_ratio)) {
                    next.aspectRatio = template.aspect_ratio;
                  }
                }
                if (
                  template.duration_seconds != null &&
                  entry.settings.duration?.type === "enum" &&
                  entry.settings.duration.values.includes(String(template.duration_seconds))
                ) {
                  next.duration = String(template.duration_seconds);
                }
                return { ...s, [entry.id]: next };
              });
            }
          } catch {
            // Unknown template — fall through to defaults.
          }
        } else if (presetModel && m.models.some((x) => x.id === presetModel)) {
          const found = m.models.find((x) => x.id === presetModel)!;
          setType(found.generationType);
          setModelId(found.id);
        } else {
          const first = m.models.find((x) => x.generationType === "image");
          if (first) setModelId(first.id);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep a valid model selected when switching type — handled in the
  // switcher below so no render-cascading effect is needed.
  function switchType(next: "image" | "video") {
    setType(next);
    const current = models.find((m) => m.id === modelId);
    if (!current || current.generationType !== next) {
      const first = models.find((m) => m.generationType === next);
      setModelId(first ? first.id : "");
      setAssets([]);
    }
  }

  // Debounced cost estimate (brand context included — it ships in the
  // final prompt). State only changes inside the timeout callback.
  useEffect(() => {
    if (!model) return;
    const t = setTimeout(async () => {
      if (!composedPrompt.trim()) {
        setEstimate(null);
        return;
      }
      try {
        const res = await api.estimate({
          model: model.id,
          generationType: type,
          prompt: composedPrompt.trim(),
          negativePrompt: negativePrompt.trim() || undefined,
          inputAssets: assets,
          settings: values,
        });
        setEstimate(res.estimate);
      } catch {
        setEstimate(null);
      }
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId, type, prompt, brandId, negativePrompt, assets, JSON.stringify(values)]);

  function setValue(key: string, value: unknown) {
    setSettings((s) => ({ ...s, [modelId]: { ...(s[modelId] ?? {}), [key]: value } }));
  }

  function withDefaults(m: ApiModel): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, f] of Object.entries(m.settings)) {
      const v = values[k] ?? (f.type === "integer" ? "" : f.default);
      if (v !== "") out[k] = v;
    }
    return out;
  }

  async function addFiles(role: Role, files: FileList | null) {
    if (!files || files.length === 0 || !model) return;
    const cap = model.mediaRoles[role] ?? 0;
    const existing = assets.filter((a) => a.role === role).length;
    const room = Math.max(0, cap - existing);
    if (room === 0) return;
    setUploading(true);
    setError(null);
    try {
      const picked = [...files].slice(0, room);
      const urls = await Promise.all(picked.map((f) => uploadFile(f)));
      setAssets((a) => [...a, ...urls.map((url) => ({ url, role }))]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  interface SubmitInput {
    model: ApiModel;
    generationType: "image" | "video";
    prompt: string;
    negativePrompt?: string;
    projectId?: string;
    brandId?: string;
    templateId?: string;
    inputAssets: Array<{ url: string; role: Role }>;
    settings: Record<string, unknown>;
  }

  function watchLive(id: string) {
    stopPolling();
    const startedAt = Date.now();
    pollTimer.current = setInterval(async () => {
      if (Date.now() - startedAt > POLL_DEADLINE_MS) {
        stopPolling();
        setSubmitting(false);
        setError("Still working after 10 minutes — it will land in your library when done.");
        return;
      }
      try {
        const { generation: fresh } = await api.getGeneration(id);
        setLive(fresh);
        if (fresh.status === "completed" || fresh.status === "failed" || fresh.status === "cancelled") {
          stopPolling();
          setSubmitting(false);
          if (fresh.status === "failed") setError(fresh.error ?? "Generation failed");
        }
      } catch {
        // Keep polling.
      }
    }, 4000);
  }

  async function submitAndWatch(input: SubmitInput) {
    setSubmitting(true);
    setError(null);
    setLive(null);
    try {
      const { generation } = await api.createGeneration({
        model: input.model.id,
        generationType: input.generationType,
        prompt: input.prompt.trim(),
        negativePrompt: input.negativePrompt?.trim() || undefined,
        projectId: input.projectId || undefined,
        brandId: input.brandId || undefined,
        templateId: input.templateId || undefined,
        inputAssets: input.inputAssets,
        settings: input.settings,
      });
      setLive(generation);
      watchLive(generation.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
      setSubmitting(false);
    }
  }

  async function generate() {
    if (!model || !prompt.trim() || submitting) return;
    await submitAndWatch({
      model,
      generationType: type,
      prompt: composedPrompt,
      negativePrompt: negativePrompt || undefined,
      projectId: projectId || undefined,
      brandId: brandId || undefined,
      templateId: templateId || undefined,
      inputAssets: assets,
      settings: withDefaults(model),
    });
  }

  const filtered = query.trim()
    ? typeModels.filter((m) =>
        `${m.label} ${m.blurb}`.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : typeModels;

  if (models.length === 0) {
    return (
      <div className="space-y-3">
        <div className="h-10 w-64 animate-pulse rounded-xl bg-panel" />
        <div className="h-64 animate-pulse rounded-2xl bg-panel" />
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create</h1>
        <p className="mt-1 text-sm text-mute">Pick a medium, a model, and describe the shot.</p>
      </div>

      {/* Image / Video toggle */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-edge bg-panel p-1">
        {(["image", "video"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => switchType(t)}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium capitalize transition ${
              type === t ? "bg-accent text-accent-ink" : "text-mute hover:text-ink"
            }`}
          >
            {t === "image" ? "🖼 Image" : "🎬 Video"}
          </button>
        ))}
      </div>

      {/* Model picker */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          aria-expanded={pickerOpen}
          className="flex w-full items-center justify-between rounded-2xl border border-edge bg-panel px-4 py-3 text-left transition hover:border-faint"
        >
          <span>
            <span className="block text-[11px] uppercase tracking-wide text-faint">Model</span>
            <span className="block font-semibold">{model?.label ?? "Select a model"}</span>
          </span>
          <span className="text-mute">▾</span>
        </button>
        {pickerOpen && (
          <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-2xl border border-edge bg-panel-2 shadow-2xl">
            <div className="p-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search models…"
                className="w-full rounded-xl border border-edge bg-panel px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent"
              />
            </div>
            <div className="kibo-scroll max-h-72 overflow-y-auto p-2 pt-0">
              {filtered.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setModelId(m.id);
                    setAssets([]);
                    setPickerOpen(false);
                    setQuery("");
                  }}
                  className={`w-full rounded-xl px-3 py-2.5 text-left transition hover:bg-panel ${
                    m.id === modelId ? "bg-panel" : ""
                  }`}
                >
                  <span className="block text-sm font-medium">{m.label}</span>
                  <span className="block truncate text-xs text-mute">{m.blurb}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 py-4 text-sm text-mute">No models match “{query}”.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Prompt */}
      <div className="rounded-2xl border border-edge bg-panel p-4">
        {templateName && (
          <div className="mb-3 flex items-center justify-between rounded-xl bg-accent/10 px-3 py-2 text-sm">
            <span>
              📋 Template: <strong>{templateName}</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                setTemplateId("");
                setTemplateName("");
              }}
              className="text-mute transition hover:text-ink"
              aria-label="Clear template"
            >
              ✕
            </button>
          </div>
        )}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder={
            type === "image"
              ? "Describe the image — subject, style, light, lens…"
              : "Describe the shot — subject, camera move, light, pacing…"
          }
          aria-label="Prompt"
          className="w-full resize-y bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-faint"
        />
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="mt-2 text-xs text-mute transition hover:text-ink"
        >
          {showAdvanced
            ? "▾ Hide advanced"
            : model?.capabilities.negativePrompt
              ? "▸ Negative prompt, project & brand"
              : "▸ Project & brand"}
        </button>
        {showAdvanced && (
          <div className="mt-3 space-y-3 border-t border-edge pt-3">
            {model?.capabilities.negativePrompt && (
              <label className="block">
                <span className="mb-1 block text-xs text-mute">Negative prompt</span>
                <input
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="What to avoid…"
                  className="w-full rounded-xl border border-edge bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent"
                />
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-xs text-mute">Project (optional)</span>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full rounded-xl border border-edge bg-panel-2 px-3 py-2 text-sm outline-none focus:border-accent"
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-mute">Brand (optional)</span>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full rounded-xl border border-edge bg-panel-2 px-3 py-2 text-sm outline-none focus:border-accent"
              >
                <option value="">No brand</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {brand && prompt.trim() && (
          <div className="mt-3 rounded-xl bg-panel-2 p-3 text-xs leading-relaxed text-mute">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-faint">
              Brand context sent with your prompt
            </span>
            {applyBrand("", brand).replace(/\n\n$/, "")}
          </div>
        )}
      </div>

      {/* Reference media */}
      {model && Object.keys(model.mediaRoles).length > 0 && (
        <div className="rounded-2xl border border-edge bg-panel p-4">
          <p className="mb-3 text-sm font-medium">Reference media</p>
          <div className="space-y-3">
            {(Object.entries(model.mediaRoles) as Array<[Role, number]>).map(([role, cap]) => {
              const attached = assets.filter((a) => a.role === role);
              return (
                <div key={role}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs text-mute">
                      {ROLE_LABEL[role]} ({attached.length}/{cap})
                    </span>
                    <label
                      className={`cursor-pointer rounded-lg border border-edge px-2.5 py-1 text-xs transition hover:border-faint ${
                        uploading || attached.length >= cap ? "pointer-events-none opacity-40" : ""
                      }`}
                    >
                      + Add
                      <input
                        type="file"
                        hidden
                        multiple
                        accept={ACCEPT[role]}
                        onChange={(e) => void addFiles(role, e.target.files)}
                      />
                    </label>
                  </div>
                  {attached.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {attached.map((a) => (
                        <div key={a.url} className="relative h-16 w-16 overflow-hidden rounded-xl border border-edge">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a.url} alt={ROLE_LABEL[role]} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            aria-label="Remove"
                            onClick={() => setAssets((prev) => prev.filter((x) => x.url !== a.url))}
                            className="absolute right-0.5 top-0.5 rounded-md bg-black/70 px-1 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dynamic model settings */}
      {model && (
        <div className="rounded-2xl border border-edge bg-panel p-4">
          <p className="mb-3 text-sm font-medium">{model.label} settings</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Object.entries(model.settings).map(([key, field]) => {
              const value = values[key] ?? (field.type === "integer" ? "" : field.default);
              const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
              if (field.type === "boolean") {
                return (
                  <button
                    key={key}
                    type="button"
                    role="switch"
                    aria-checked={value === true}
                    onClick={() => setValue(key, value !== true)}
                    className="flex items-center justify-between rounded-xl border border-edge bg-panel-2 px-3 py-2.5 text-sm"
                  >
                    {label}
                    <span
                      className={`relative h-5 w-9 rounded-full transition ${value === true ? "bg-accent" : "bg-edge"}`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                          value === true ? "left-[18px]" : "left-0.5"
                        }`}
                      />
                    </span>
                  </button>
                );
              }
              if (field.type === "enum") {
                return (
                  <label key={key} className="block rounded-xl border border-edge bg-panel-2 px-3 py-2">
                    <span className="block text-[11px] uppercase tracking-wide text-faint">{label}</span>
                    <select
                      value={String(value)}
                      onChange={(e) => setValue(key, e.target.value)}
                      className="w-full bg-transparent py-1 text-sm outline-none"
                    >
                      {field.values.map((v) => (
                        <option key={v} value={v} className="bg-panel-2">
                          {key === "duration" ? `${v}s` : v}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              }
              if (field.type === "integer") {
                return (
                  <label key={key} className="block rounded-xl border border-edge bg-panel-2 px-3 py-2">
                    <span className="block text-[11px] uppercase tracking-wide text-faint">{label}</span>
                    <input
                      type="number"
                      min={field.min}
                      max={field.max}
                      step={1}
                      value={value === "" ? "" : Number(value)}
                      placeholder={field.optional ? "Random" : undefined}
                      onChange={(e) =>
                        setValue(key, e.target.value === "" ? "" : Number(e.target.value))
                      }
                      className="w-full bg-transparent py-1 text-sm outline-none placeholder:text-faint"
                    />
                  </label>
                );
              }
              return (
                <label key={key} className="block rounded-xl border border-edge bg-panel-2 px-3 py-2">
                  <span className="mb-1 flex justify-between text-[11px] uppercase tracking-wide text-faint">
                    {label}
                    <span className="text-ink">{String(value)}</span>
                  </span>
                  <input
                    type="range"
                    min={field.min}
                    max={field.max}
                    step={field.step ?? 1}
                    value={Number(value)}
                    onChange={(e) => setValue(key, Number(e.target.value))}
                    className="w-full accent-[#d1fe17]"
                  />
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Cost + Generate */}
      <div className="rounded-2xl border border-edge bg-panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-mute">Estimated cost</span>
          <span className="text-xl font-bold tabular-nums">
            {estimate ? formatUsd(estimate.amountUsd) : "—"}
          </span>
        </div>
        {estimate?.breakdown && <p className="mb-3 text-xs text-faint">{estimate.breakdown}</p>}
        {error && (
          <p role="alert" className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={!prompt.trim() || submitting || uploading}
          onClick={generate}
          className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-accent-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {!prompt.trim()
            ? "Write a prompt first"
            : submitting
              ? "Generating…"
              : `✦ Generate${estimate ? ` · ${formatUsd(estimate.amountUsd)}` : ""}`}
        </button>
      </div>

      {/* Live progress */}
      {live && (
        <div className="kibo-rise overflow-hidden rounded-2xl border border-edge bg-panel">
          <div className="border-b border-edge px-4 py-3">
            <p className="text-sm font-medium">
              {live.status === "completed"
                ? "✓ Completed"
                : live.status === "failed"
                  ? "✕ Failed"
                  : live.status === "cancelled"
                    ? "Cancelled"
                    : live.status === "processing"
                      ? "Generating…"
                      : "Queued…"}
            </p>
            {live.status !== "completed" && live.status !== "failed" && (
              <p className="mt-0.5 text-xs text-mute">This updates automatically — no refresh needed.</p>
            )}
          </div>
          {live.output_url && (
            <div className="bg-black">
              {live.generation_type === "video" ? (
                <video src={live.output_url} controls playsInline className="max-h-[480px] w-full" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={live.output_url} alt={live.prompt} className="max-h-[480px] w-full object-contain" />
              )}
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs text-mute">Saved to your library</span>
            <Link href="/library" className="text-sm font-medium text-accent hover:brightness-110">
              Open library →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-panel" />}>
      <CreateStudio />
    </Suspense>
  );
}

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, formatUsd, uploadFile, type ApiGeneration, type ApiModel, type ApiProject } from "@/lib/api";

type Role = "start" | "end" | "reference" | "video" | "audio";

const ROLE_LABEL: Record<Role, string> = {
  start: "Start frame",
  end: "End frame",
  reference: "Reference",
  video: "Video",
  audio: "Audio",
};

const ACCEPT: Record<Role, string> = {
  start: "image/*",
  end: "image/*",
  reference: "image/*",
  video: "video/mp4",
  audio: "audio/wav,audio/mpeg",
};

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
  const [estimate, setEstimate] = useState<{ amountUsd: number; breakdown?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<ApiGeneration | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const model = useMemo(() => models.find((m) => m.id === modelId), [models, modelId]);
  const typeModels = useMemo(() => models.filter((m) => m.generationType === type), [models, type]);
  const values = settings[modelId] ?? {};

  const stopPolling = useCallback(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = null;
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  // Initial data + reuse / model preselect from URL.
  useEffect(() => {
    Promise.all([api.models(), api.projects()])
      .then(async ([m, p]) => {
        setModels(m.models);
        setProjects(p.projects);
        const reuseId = searchParams.get("reuse");
        const presetModel = searchParams.get("model");
        if (reuseId) {
          try {
            const { generation } = await api.getGeneration(reuseId);
            setType(generation.generation_type);
            setModelId(generation.model);
            setPrompt(generation.prompt);
            setNegativePrompt(generation.negative_prompt ?? "");
            setSettings((s) => ({ ...s, [generation.model]: generation.settings }));
            setProjectId(generation.project_id ?? "");
          } catch {
            // Fall through to defaults.
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

  // Keep a valid model selected when switching type.
  useEffect(() => {
    if (!model || model.generationType !== type) {
      const first = typeModels[0];
      if (first) {
        setModelId(first.id);
        setAssets([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // Debounced cost estimate.
  useEffect(() => {
    if (!model || !prompt.trim()) {
      setEstimate(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await api.estimate({
          model: model.id,
          generationType: type,
          prompt: prompt.trim(),
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
  }, [modelId, type, prompt, negativePrompt, assets, JSON.stringify(values)]);

  function setValue(key: string, value: unknown) {
    setSettings((s) => ({ ...s, [modelId]: { ...(s[modelId] ?? {}), [key]: value } }));
  }

  function withDefaults(m: ApiModel): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, f] of Object.entries(m.settings)) out[k] = (values[k] ?? f.default);
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

  async function generate() {
    if (!model || !prompt.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    setLive(null);
    try {
      const { generation } = await api.createGeneration({
        model: model.id,
        generationType: type,
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim() || undefined,
        projectId: projectId || undefined,
        inputAssets: assets,
        settings: withDefaults(model),
      });
      setLive(generation);
      stopPolling();
      pollTimer.current = setInterval(async () => {
        try {
          const { generation: fresh } = await api.getGeneration(generation.id);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
      setSubmitting(false);
    }
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
            onClick={() => setType(t)}
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
          {showAdvanced ? "▾ Hide advanced" : "▸ Negative prompt & project"}
        </button>
        {showAdvanced && (
          <div className="mt-3 space-y-3 border-t border-edge pt-3">
            <label className="block">
              <span className="mb-1 block text-xs text-mute">Negative prompt</span>
              <input
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="What to avoid…"
                className="w-full rounded-xl border border-edge bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent"
              />
            </label>
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
              const value = values[key] ?? field.default;
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

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type ApiTemplate } from "@/lib/api";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [structure, setStructure] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.templates().then((r) => setTemplates(r.templates)).catch(() => {});
  }, []);

  async function create() {
    if (!name.trim() || !structure.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const { template } = await api.createTemplate({
        name: name.trim(),
        promptStructure: structure.trim(),
        recommendedModels: [],
      });
      setTemplates((prev) => [template, ...prev]);
      setName("");
      setStructure("");
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, templateName: string) {
    if (!confirm(`Delete template “${templateName}”?`)) return;
    try {
      await api.deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const mine = templates.filter((t) => !t.is_public);
  const shared = templates.filter((t) => t.is_public);

  function card(t: ApiTemplate) {
    return (
      <div key={t.id} className="flex flex-col rounded-2xl border border-edge bg-panel p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold">{t.name}</p>
          <span className="shrink-0 rounded-full bg-panel-2 px-2 py-0.5 text-[11px] text-faint">
            {t.is_public ? "Kibo AI" : "Yours"}
          </span>
        </div>
        {t.description && <p className="mt-1 text-sm text-mute">{t.description}</p>}
        <p className="mt-2 line-clamp-3 flex-1 rounded-xl bg-panel-2 p-2.5 font-mono text-xs leading-relaxed text-mute">
          {t.prompt_structure}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-faint">
          {t.aspect_ratio && <span className="rounded-md bg-panel-2 px-1.5 py-0.5">{t.aspect_ratio}</span>}
          {t.duration_seconds != null && (
            <span className="rounded-md bg-panel-2 px-1.5 py-0.5">{t.duration_seconds}s</span>
          )}
          {t.recommended_models.slice(0, 3).map((m) => (
            <span key={m} className="rounded-md bg-panel-2 px-1.5 py-0.5">{m}</span>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Link
            href={`/create?template=${t.id}`}
            className="flex-1 rounded-xl bg-accent px-3 py-2 text-center text-sm font-semibold text-accent-ink transition hover:brightness-110"
          >
            Use template
          </Link>
          {!t.is_public && (
            <button
              type="button"
              onClick={() => void remove(t.id, t.name)}
              className="rounded-xl border border-edge px-3 py-2 text-sm text-mute transition hover:border-red-400 hover:text-red-300"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
          <p className="mt-1 text-sm text-mute">
            One-click starting points with the right model and format baked in.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-xl border border-edge bg-panel px-4 py-2.5 text-sm transition hover:border-faint"
        >
          {showForm ? "Close" : "+ Your template"}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {showForm && (
        <div className="kibo-rise mx-auto w-full max-w-3xl space-y-3 rounded-2xl border border-edge bg-panel p-4">
          <h2 className="font-semibold">New template</h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
            className="w-full rounded-xl border border-edge bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent"
          />
          <textarea
            value={structure}
            onChange={(e) => setStructure(e.target.value)}
            rows={4}
            placeholder="Prompt structure — use {subject} where the idea goes…"
            className="w-full rounded-xl border border-edge bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent"
          />
          <button
            type="button"
            disabled={saving || !name.trim() || !structure.trim()}
            onClick={create}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save template"}
          </button>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Made by Kibo AI</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shared.map(card)}
        </div>
      </section>

      {mine.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Yours</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map(card)}
          </div>
        </section>
      )}
    </div>
  );
}

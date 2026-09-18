"use client";

import { useEffect, useState } from "react";
import { api, type ApiBrand } from "@/lib/api";

const EMPTY = {
  name: "",
  description: "",
  website: "",
  logoUrl: "",
  colors: "",
  industry: "",
  targetAudience: "",
  visualStyle: "",
  adTone: "",
  defaultCta: "",
};

function toForm(b: ApiBrand): typeof EMPTY {
  return {
    name: b.name,
    description: b.description ?? "",
    website: b.website ?? "",
    logoUrl: b.logo_url ?? "",
    colors: (b.colors ?? []).join(", "),
    industry: b.industry ?? "",
    targetAudience: b.target_audience ?? "",
    visualStyle: b.visual_style ?? "",
    adTone: b.ad_tone ?? "",
    defaultCta: b.default_cta ?? "",
  };
}

function toBody(f: typeof EMPTY): Record<string, unknown> {
  return {
    name: f.name.trim(),
    description: f.description.trim() || undefined,
    website: f.website.trim() || undefined,
    logoUrl: f.logoUrl.trim() || undefined,
    colors: f.colors
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 12),
    industry: f.industry.trim() || undefined,
    targetAudience: f.targetAudience.trim() || undefined,
    visualStyle: f.visualStyle.trim() || undefined,
    adTone: f.adTone.trim() || undefined,
    defaultCta: f.defaultCta.trim() || undefined,
  };
}

const FIELDS: Array<{ key: keyof typeof EMPTY; label: string; placeholder: string }> = [
  { key: "description", label: "Description", placeholder: "What the brand does…" },
  { key: "website", label: "Website", placeholder: "https://…" },
  { key: "logoUrl", label: "Logo URL", placeholder: "https://…/logo.png" },
  { key: "colors", label: "Brand colors (comma separated)", placeholder: "#0A0A0F, #D1FE17" },
  { key: "industry", label: "Industry", placeholder: "e.g. Retail tech" },
  { key: "targetAudience", label: "Target audience", placeholder: "e.g. Shop owners in Nairobi" },
  { key: "visualStyle", label: "Preferred visual style", placeholder: "e.g. Warm cinematic realism" },
  { key: "adTone", label: "Advertising tone", placeholder: "e.g. Bold but trustworthy" },
  { key: "defaultCta", label: "Default call-to-action", placeholder: "e.g. Shop now on DukaPilot" },
];

export default function BrandsPage() {
  const [brands, setBrands] = useState<ApiBrand[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.brands().then((r) => setBrands(r.brands)).catch(() => {});
  }, []);

  function startCreate() {
    setForm(EMPTY);
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(b: ApiBrand) {
    setForm(toForm(b));
    setEditingId(b.id);
    setShowForm(true);
  }

  async function save() {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        const { brand } = await api.updateBrand(editingId, toBody(form));
        setBrands((prev) => prev.map((b) => (b.id === editingId ? brand : b)));
      } else {
        const { brand } = await api.createBrand(toBody(form));
        setBrands((prev) => [brand, ...prev]);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete brand “${name}”? Past generations keep their prompts.`)) return;
    try {
      await api.deleteBrand(id);
      setBrands((prev) => prev.filter((b) => b.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Brands</h1>
          <p className="mt-1 text-sm text-mute">
            Reusable profiles — pick one when creating and Kibo AI weaves it into your prompt.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition hover:brightness-110"
        >
          + New brand
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {showForm && (
        <div className="kibo-rise space-y-3 rounded-2xl border border-edge bg-panel p-4">
          <h2 className="font-semibold">{editingId ? "Edit brand" : "New brand"}</h2>
          <label className="block">
            <span className="mb-1 block text-xs text-mute">Brand name *</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. DukaPilot"
              className="w-full rounded-xl border border-edge bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent"
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1 block text-xs text-mute">{f.label}</span>
                <input
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className="w-full rounded-xl border border-edge bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent"
                />
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving || !form.name.trim()}
              onClick={save}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-40"
            >
              {saving ? "Saving…" : editingId ? "Save changes" : "Create brand"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="rounded-xl border border-edge px-4 py-2 text-sm transition hover:border-faint"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {brands.map((b) => (
          <div key={b.id} className="rounded-2xl border border-edge bg-panel p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-panel-2 text-lg font-bold">
                  {b.name[0]?.toUpperCase()}
                </span>
                <div>
                  <p className="font-semibold">{b.name}</p>
                  {b.industry && <p className="text-xs text-faint">{b.industry}</p>}
                </div>
              </div>
            </div>
            {b.description && <p className="mt-2 line-clamp-2 text-sm text-mute">{b.description}</p>}
            {(b.colors?.length ?? 0) > 0 && (
              <div className="mt-2 flex gap-1.5">
                {b.colors.slice(0, 6).map((c) => (
                  <span
                    key={c}
                    title={c}
                    className="h-5 w-5 rounded-md border border-edge"
                    style={{ background: c }}
                  />
                ))}
              </div>
            )}
            <div className="mt-3 flex gap-1">
              <button
                type="button"
                onClick={() => startEdit(b)}
                className="rounded-lg px-2 py-1 text-xs text-mute transition hover:bg-panel-2 hover:text-ink"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => void remove(b.id, b.name)}
                className="rounded-lg px-2 py-1 text-xs text-mute transition hover:bg-panel-2 hover:text-red-300"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {brands.length === 0 && !showForm && (
        <div className="rounded-2xl border border-dashed border-edge bg-panel/50 p-10 text-center">
          <p className="font-medium">No brands yet</p>
          <p className="mt-1 text-sm text-mute">
            Create DukaPilot, Necuva Group or Primehaul once — reuse everywhere.
          </p>
        </div>
      )}
    </div>
  );
}

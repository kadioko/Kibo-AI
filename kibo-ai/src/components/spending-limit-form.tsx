"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function SpendingLimitForm() {
  const [limit, setLimit] = useState<string>("");
  const [saved, setSaved] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .spendingLimit()
      .then((r) => {
        setSaved(r.limit);
        setLimit(r.limit != null ? String(r.limit) : "");
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const value = limit.trim() === "" ? null : Number(limit);
      if (value !== null && (!Number.isFinite(value) || value <= 0)) {
        throw new Error("Enter an amount above $0, or clear the field.");
      }
      const { limit: next } = await api.setSpendingLimit(value);
      setSaved(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <div className="h-10 animate-pulse rounded-xl bg-panel-2" />;

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-faint">
            $
          </span>
          <input
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            inputMode="decimal"
            placeholder="No limit"
            aria-label="Monthly spending limit in USD"
            className="w-full rounded-xl border border-edge bg-panel-2 py-2 pl-7 pr-3 text-sm outline-none placeholder:text-faint focus:border-accent"
          />
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      <p className="mt-2 text-xs text-faint">
        {saved != null
          ? `Capped at $${saved.toFixed(2)}/month. New generations are blocked (402) once projected spend passes the cap.`
          : "No cap set — generations are billed pay-as-you-go."}
      </p>
    </div>
  );
}

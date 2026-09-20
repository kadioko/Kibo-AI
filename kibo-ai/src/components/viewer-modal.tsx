"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  api,
  formatUsd,
  generationCostSummary,
  timeAgo,
  type ApiGeneration,
} from "@/lib/api";

interface Asset {
  id: string;
  url: string | null;
  mimeType: string | null;
}

export function ViewerModal({
  generation,
  onClose,
  onChanged,
}: {
  generation: ApiGeneration;
  onClose: () => void;
  onChanged: (next: ApiGeneration | null) => void;
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const g = generation;
  const cost = generationCostSummary(g);

  useEffect(() => {
    api
      .getAssets(g.id)
      .then((r) => setAssets(r.assets))
      .catch(() => {});
  }, [g.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => i + 1);
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const files = assets.filter((a) => a.url);
  const current = files[Math.min(index, Math.max(0, files.length - 1))];
  const isVideo = g.generation_type === "video";

  async function toggleFavorite() {
    setBusy(true);
    try {
      const { is_favorite } = await api.toggleFavorite(g.id);
      onChanged({ ...g, is_favorite });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this generation and all its files?")) return;
    setBusy(true);
    try {
      await api.deleteGeneration(g.id);
      onChanged(null);
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Generation — ${g.model}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="kibo-rise flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-edge bg-panel">
        <div className="flex items-center justify-between border-b border-edge px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{g.model}</p>
            <p className="text-xs text-faint">
              {timeAgo(g.created_at)} · {cost.amount == null ? cost.label : `${cost.label} ${formatUsd(cost.amount)}`} · {g.status}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close viewer"
            className="rounded-lg px-2.5 py-1.5 text-mute transition hover:bg-panel-2 hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="kibo-scroll grid flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[1fr_260px]">
          <div className="flex min-h-64 items-center justify-center bg-black p-4">
            {current?.url ? (
              isVideo ? (
                <video key={current.id} src={current.url} controls playsInline className="max-h-[60vh] w-full" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current.url} alt={g.prompt} className="max-h-[60vh] w-full object-contain" />
              )
            ) : (
              <p className="text-sm text-faint">No stored file yet.</p>
            )}
          </div>

          <div className="space-y-4 border-t border-edge p-4 md:border-l md:border-t-0">
            {files.length > 1 && (
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-faint">
                  {files.length} outputs
                </p>
                <div className="flex flex-wrap gap-2">
                  {files.map((a, i) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setIndex(i)}
                      className={`h-14 w-14 overflow-hidden rounded-lg border transition ${
                        a.url === current?.url ? "border-accent" : "border-edge hover:border-faint"
                      }`}
                    >
                      {isVideo ? (
                        <span className="flex h-full w-full items-center justify-center bg-panel-2 text-xs">
                          ▶ {i + 1}
                        </span>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.url!} alt={`Output ${i + 1}`} className="h-full w-full object-cover" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-faint">Prompt</p>
              <p className="text-sm leading-relaxed">{g.prompt}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {current?.url && (
                <a
                  href={current.url}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-accent px-3 py-2 text-center text-sm font-semibold text-accent-ink transition hover:brightness-110"
                >
                  ⭳ Download{files.length > 1 ? ` (${index + 1})` : ""}
                </a>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={toggleFavorite}
                className="rounded-xl border border-edge px-3 py-2 text-sm transition hover:border-faint disabled:opacity-50"
              >
                {g.is_favorite ? "♥ Favorited" : "♡ Favorite"}
              </button>
              <Link
                href={`/create?reuse=${g.id}`}
                className="rounded-xl border border-edge px-3 py-2 text-center text-sm transition hover:border-faint"
              >
                ↻ Reuse
              </Link>
              <Link
                href={`/create?regenerate=${g.id}`}
                className="rounded-xl border border-edge px-3 py-2 text-center text-sm transition hover:border-accent hover:text-accent"
              >
                ⚡ Regenerate
              </Link>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={remove}
              className="w-full rounded-xl border border-edge px-3 py-2 text-sm text-mute transition hover:border-red-400 hover:text-red-300 disabled:opacity-50"
            >
              Delete generation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

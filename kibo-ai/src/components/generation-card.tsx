"use client";

import Link from "next/link";
import { api, formatUsd, timeAgo, type ApiGeneration } from "@/lib/api";
import { useState } from "react";

function statusStyle(status: ApiGeneration["status"]): string {
  switch (status) {
    case "completed":
      return "bg-emerald-500/15 text-emerald-300";
    case "processing":
    case "queued":
      return "bg-accent/15 text-accent kibo-live";
    case "failed":
      return "bg-red-500/15 text-red-300";
    case "cancelled":
      return "bg-zinc-500/15 text-zinc-400";
    default:
      return "bg-zinc-500/15 text-zinc-400";
  }
}

export function GenerationCard({
  generation,
  onChanged,
}: {
  generation: ApiGeneration;
  onChanged: (next: ApiGeneration | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const g = generation;
  const inFlight = g.status === "queued" || g.status === "processing";

  async function toggleFavorite() {
    setBusy(true);
    try {
      const { is_favorite } = await api.toggleFavorite(g.id);
      onChanged({ ...g, is_favorite });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this generation?")) return;
    setBusy(true);
    try {
      await api.deleteGeneration(g.id);
      onChanged(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <div className="kibo-rise group overflow-hidden rounded-2xl border border-edge bg-panel">
      <div className="relative aspect-[4/3] bg-panel-2">
        {g.output_url ? (
          g.generation_type === "video" ? (
            <video
              src={g.output_url}
              className="h-full w-full object-cover"
              muted
              loop
              playsInline
              preload="metadata"
              onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
              onMouseLeave={(e) => {
                e.currentTarget.pause();
                e.currentTarget.currentTime = 0;
              }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={g.output_url} alt={g.prompt} className="h-full w-full object-cover" loading="lazy" />
          )
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
            {inFlight ? (
              <>
                <span className="kibo-live text-sm font-medium text-accent">
                  {g.status === "queued" ? "Queued" : "Generating…"}
                </span>
                <span className="text-xs text-faint">Stay on this page — it updates live</span>
              </>
            ) : g.status === "failed" ? (
              <>
                <span className="text-sm font-medium text-red-300">Failed</span>
                <span className="line-clamp-2 text-xs text-faint">{g.error}</span>
              </>
            ) : (
              <span className="text-xs text-faint">No output</span>
            )}
          </div>
        )}
        <span
          className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusStyle(g.status)}`}
        >
          {g.status}
        </span>
        {g.generation_type === "video" && g.output_url && (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px]">
            ▶
          </span>
        )}
      </div>

      <div className="p-3">
        <p className="line-clamp-2 text-sm leading-snug">{g.prompt}</p>
        <div className="mt-2 flex items-center justify-between text-xs text-faint">
          <span className="truncate">{g.model}</span>
          <span className="shrink-0">{formatUsd(g.actual_cost ?? g.estimated_cost)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-faint">
          <span>{timeAgo(g.created_at)}</span>
          <div className="flex items-center gap-1">
            {g.output_url && (
              <a
                href={g.output_url}
                download
                target="_blank"
                rel="noreferrer"
                title="Download"
                className="rounded-lg px-2 py-1 transition hover:bg-panel-2 hover:text-ink"
              >
                ⭳
              </a>
            )}
            <Link
              href={`/create?reuse=${g.id}`}
              title="Reuse prompt & settings"
              className="rounded-lg px-2 py-1 transition hover:bg-panel-2 hover:text-ink"
            >
              ↻
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={toggleFavorite}
              title={g.is_favorite ? "Unfavorite" : "Favorite"}
              aria-pressed={g.is_favorite}
              className={`rounded-lg px-2 py-1 transition hover:bg-panel-2 ${
                g.is_favorite ? "text-accent" : "hover:text-ink"
              }`}
            >
              {g.is_favorite ? "♥" : "♡"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={remove}
              title="Delete"
              className="rounded-lg px-2 py-1 transition hover:bg-panel-2 hover:text-red-300"
            >
              🗑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

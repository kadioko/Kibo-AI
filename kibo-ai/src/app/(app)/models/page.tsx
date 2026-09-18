"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type ApiModel } from "@/lib/api";

export default function ModelsPage() {
  const [models, setModels] = useState<ApiModel[]>([]);
  const [tab, setTab] = useState<"all" | "image" | "video">("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.models().then((r) => setModels(r.models)).catch((e) => setError(e.message));
  }, []);

  const list = models.filter(
    (m) =>
      (tab === "all" || m.generationType === tab) &&
      (!query.trim() || `${m.label} ${m.blurb}`.toLowerCase().includes(query.trim().toLowerCase())),
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Models</h1>
        <p className="mt-1 text-sm text-mute">{models.length} models through one studio.</p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "image", "video"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm capitalize transition ${
              tab === t ? "bg-accent font-medium text-accent-ink" : "bg-panel-2 text-mute hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search models…"
          className="ml-auto w-full rounded-xl border border-edge bg-panel px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent sm:w-56"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((m) => (
          <div key={m.id} className="flex flex-col rounded-2xl border border-edge bg-panel p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">{m.label}</p>
              <span className="shrink-0 rounded-full bg-panel-2 px-2 py-0.5 text-[11px] uppercase tracking-wide text-mute">
                {m.generationType}
              </span>
            </div>
            <p className="mt-1 flex-1 text-sm text-mute">{m.blurb}</p>
            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-faint">
              {m.capabilities.imageToVideo && <span className="rounded-md bg-panel-2 px-1.5 py-0.5">img→video</span>}
              {m.capabilities.maxReferences > 0 && (
                <span className="rounded-md bg-panel-2 px-1.5 py-0.5">+{m.capabilities.maxReferences} refs</span>
              )}
              {m.capabilities.audioSupport && <span className="rounded-md bg-panel-2 px-1.5 py-0.5">audio</span>}
              {m.capabilities.durations.length > 0 && (
                <span className="rounded-md bg-panel-2 px-1.5 py-0.5">
                  {m.capabilities.durations.join("/")}s
                </span>
              )}
            </div>
            <Link
              href={`/create?model=${m.id}`}
              className="mt-3 rounded-xl border border-edge px-3 py-2 text-center text-sm transition hover:border-accent hover:text-accent"
            >
              Use this model
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

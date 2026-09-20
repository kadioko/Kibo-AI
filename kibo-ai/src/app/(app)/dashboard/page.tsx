"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, formatUsd, type ApiGeneration, type ApiModel, type ApiProject } from "@/lib/api";
import { GenerationCard } from "@/components/generation-card";

export default function DashboardPage() {
  const [stats, setStats] = useState<{
    generationsMonth: number;
    images: number;
    videos: number;
    spend: number;
    active: number;
  } | null>(null);
  const [recent, setRecent] = useState<ApiGeneration[]>([]);
  const [models, setModels] = useState<ApiModel[]>([]);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.stats(), api.listGenerations({ limit: "8" }), api.models(), api.projects()])
      .then(([s, r, m, p]) => {
        setStats(s.stats);
        setRecent(r.generations);
        setModels(m.models);
        setProjects(p.projects.slice(0, 4));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  function handleChanged(next: ApiGeneration | null, id: string) {
    setRecent((prev) =>
      next ? prev.map((g) => (g.id === id ? next : g)) : prev.filter((g) => g.id !== id),
    );
  }

  const cards: Array<{ label: string; value: string }> = stats
    ? [
        { label: "Generations this month", value: String(stats.generationsMonth) },
        { label: "Images generated", value: String(stats.images) },
        { label: "Videos generated", value: String(stats.videos) },
        { label: "API spend (month)", value: formatUsd(stats.spend) },
        { label: "Active generations", value: String(stats.active) },
      ]
    : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-mute">Your creative studio at a glance.</p>
        </div>
        <Link
          href="/create"
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition hover:brightness-110"
        >
          ✦ New creation
        </Link>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.length > 0
          ? cards.map((c) => (
              <div key={c.label} className="rounded-2xl border border-edge bg-panel p-4">
                <p className="text-2xl font-bold tabular-nums">{c.value}</p>
                <p className="mt-1 text-xs text-mute">{c.label}</p>
              </div>
            ))
          : Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[92px] animate-pulse rounded-2xl border border-edge bg-panel" />
            ))}
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent generations</h2>
          <Link href="/library" className="text-sm text-mute transition hover:text-ink">
            View library →
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-edge bg-panel/50 p-10 text-center">
            <p className="font-medium">Nothing generated yet</p>
            <p className="mt-1 text-sm text-mute">Describe an idea and press Generate.</p>
            <Link
              href="/create"
              className="mt-4 inline-block rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
            >
              Start creating
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((g) => (
              <GenerationCard key={g.id} generation={g} onChanged={(n) => handleChanged(n, g.id)} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Favorite models</h2>
          <Link href="/models" className="text-sm text-mute transition hover:text-ink">
            Browse all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {models.slice(0, 4).map((m) => (
            <Link
              key={m.id}
              href={`/create?model=${m.id}`}
              className="rounded-2xl border border-edge bg-panel p-4 transition hover:border-faint"
            >
              <p className="font-medium">{m.label}</p>
              <p className="mt-1 line-clamp-2 text-xs text-mute">{m.blurb}</p>
              <p className="mt-2 text-[11px] uppercase tracking-wide text-faint">{m.generationType}</p>
            </Link>
          ))}
        </div>
      </section>

      {projects.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent projects</h2>
            <Link href="/projects" className="text-sm text-mute transition hover:text-ink">
              All projects →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/library?project=${p.id}`}
                className="rounded-2xl border border-edge bg-panel p-4 transition hover:border-faint"
              >
                <p className="font-medium">{p.name}</p>
                <p className="mt-1 text-xs text-faint">
                  {p.team_id ? "Team project" : "Personal"}
                </p>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-mute">Est. {formatUsd(p.estimated_cost)}</span>
                  <span className="text-emerald-300">Final {formatUsd(p.actual_cost)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { api, type ApiGeneration, type ApiModel, type ApiProject } from "@/lib/api";
import { GenerationCard } from "@/components/generation-card";

type Filter = "all" | "image" | "video" | "favorites";

const TABS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "image", label: "Images" },
  { id: "video", label: "Videos" },
  { id: "favorites", label: "Favorites" },
];

export default function LibraryPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-panel" />}>
      <LibraryStudio />
    </Suspense>
  );
}

function LibraryStudio() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Filter>("all");
  const [items, setItems] = useState<ApiGeneration[]>([]);
  const [models, setModels] = useState<ApiModel[]>([]);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [model, setModel] = useState("");
  const [project, setProject] = useState("");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (reset: boolean) => {
      if (reset) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const params: Record<string, string> = { type: tab, limit: "24" };
        if (model) params.model = model;
        if (project) params.projectId = project;
        if (search.trim()) params.search = search.trim();
        if (!reset && cursor) params.cursor = cursor;
        const res = await api.listGenerations(params);
        setItems((prev) => (reset ? res.generations : [...prev, ...res.generations]));
        setCursor(res.nextCursor);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [tab, model, project, search, cursor],
  );

  useEffect(() => {
    api.models().then((r) => setModels(r.models)).catch(() => {});
    api.projects().then((r) => {
      setProjects(r.projects);
      const preset = searchParams.get("project");
      if (preset && r.projects.some((p) => p.id === preset)) setProject(preset);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCursor(null);
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, model, project]);

  useEffect(() => {
    const t = setTimeout(() => {
      setCursor(null);
      void load(true);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Live-refresh in-flight generations every 5s.
  useEffect(() => {
    if (!items.some((g) => g.status === "queued" || g.status === "processing")) return;
    const t = setInterval(async () => {
      const flying = items.filter((g) => g.status === "queued" || g.status === "processing");
      try {
        const updated = await Promise.all(flying.map((g) => api.getGeneration(g.id)));
        setItems((prev) =>
          prev.map((g) => updated.find((u) => u.generation.id === g.id)?.generation ?? g),
        );
      } catch {
        // Next tick will retry.
      }
    }, 5000);
    return () => clearInterval(t);
  }, [items]);

  function handleChanged(next: ApiGeneration | null, id: string) {
    setItems((prev) =>
      next ? prev.map((g) => (g.id === id ? next : g)) : prev.filter((g) => g.id !== id),
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Library</h1>
        <p className="mt-1 text-sm text-mute">Every generation, searchable in one place.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm transition ${
              tab === t.id ? "bg-accent font-medium text-accent-ink" : "bg-panel-2 text-mute hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search prompts…"
          className="rounded-xl border border-edge bg-panel px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent"
        />
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="rounded-xl border border-edge bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">All models</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          value={project}
          onChange={(e) => setProject(e.target.value)}
          className="rounded-xl border border-edge bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl border border-edge bg-panel" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-edge bg-panel/50 p-10 text-center">
          <p className="font-medium">No generations found</p>
          <p className="mt-1 text-sm text-mute">Try a different filter, or create something new.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((g) => (
              <GenerationCard key={g.id} generation={g} onChanged={(n) => handleChanged(n, g.id)} />
            ))}
          </div>
          {cursor && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => load(false)}
                className="rounded-xl border border-edge bg-panel px-5 py-2.5 text-sm transition hover:border-faint disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

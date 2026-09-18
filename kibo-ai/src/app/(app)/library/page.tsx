"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { api, type ApiGeneration, type ApiModel, type ApiProject } from "@/lib/api";
import { GenerationCard } from "@/components/generation-card";

type Filter = "all" | "image" | "video" | "favorites";

const TABS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "image", label: "Images" },
  { id: "video", label: "Videos" },
  { id: "favorites", label: "Favorites" },
];

interface FilterState {
  type: Filter;
  model: string;
  project: string;
  search: string;
  days: string;
}

const INITIAL_FILTERS: FilterState = { type: "all", model: "", project: "", search: "", days: "" };

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
  const [days, setDays] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Pagination cursor lives in a ref: it is written from fetch results and
  // read by the "load more" handler, so it never drives renders or effects.
  const cursorRef = useRef<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function paramsFor(f: FilterState, cursor?: string | null): Record<string, string> {
    const params: Record<string, string> = { type: f.type, limit: "24" };
    if (f.model) params.model = f.model;
    if (f.project) params.projectId = f.project;
    if (f.search.trim()) params.search = f.search.trim();
    if (f.days) params.days = f.days;
    if (cursor) params.cursor = cursor;
    return params;
  }

  // Mount: first page + catalog. State updates live inside .then callbacks,
  // the same pattern as the dashboard — never synchronously in the body.
  useEffect(() => {
    api
      .listGenerations(paramsFor(INITIAL_FILTERS))
      .then((res) => {
        setItems(res.generations);
        cursorRef.current = res.nextCursor;
        setHasMore(res.nextCursor !== null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to load");
        setLoading(false);
      });
    api.models().then((r) => setModels(r.models)).catch(() => {});
    api
      .projects()
      .then((r) => {
        setProjects(r.projects);
        const preset = searchParams.get("project");
        if (preset && r.projects.some((p) => p.id === preset)) {
          setProject(preset);
          api
            .listGenerations(paramsFor({ ...INITIAL_FILTERS, project: preset }))
            .then((res) => {
              setItems(res.generations);
              cursorRef.current = res.nextCursor;
              setHasMore(res.nextCursor !== null);
            })
            .catch((e: unknown) =>
              setError(e instanceof Error ? e.message : "Failed to load"),
            );
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  // All refetches below run from event handlers (not effects): the filter
  // snapshot travels explicitly, so no effect needs to mirror state.
  function refresh(next: FilterState) {
    setLoading(true);
    api
      .listGenerations(paramsFor(next))
      .then((res) => {
        setItems(res.generations);
        cursorRef.current = res.nextCursor;
        setHasMore(res.nextCursor !== null);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to load");
        setLoading(false);
      });
  }

  function selectTab(next: Filter) {
    setTab(next);
    refresh({ type: next, model, project, search, days });
  }

  function selectModel(next: string) {
    setModel(next);
    refresh({ type: tab, model: next, project, search, days });
  }

  function selectProject(next: string) {
    setProject(next);
    refresh({ type: tab, model, project: next, search, days });
  }

  function selectDays(next: string) {
    setDays(next);
    refresh({ type: tab, model, project, search, days: next });
  }

  function changeSearch(next: string) {
    setSearch(next);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      refresh({ type: tab, model, project, search: next, days });
    }, 400);
  }

  function loadMore() {
    if (!cursorRef.current || loadingMore) return;
    setLoadingMore(true);
    api
      .listGenerations(paramsFor({ type: tab, model, project, search, days }, cursorRef.current))
      .then((res) => {
        setItems((prev) => [...prev, ...res.generations]);
        cursorRef.current = res.nextCursor;
        setHasMore(res.nextCursor !== null);
        setLoadingMore(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to load");
        setLoadingMore(false);
      });
  }

  // Live-refresh in-flight generations every 5s. Rows older than 15 min
  // stop auto-refreshing (stuck provider-side) — opening them still polls
  // once on demand via the viewer.
  useEffect(() => {
    if (!items.some((g) => g.status === "queued" || g.status === "processing")) return;
    const t = setInterval(async () => {
      const cutoff = Date.now() - 15 * 60_000;
      const flying = items.filter(
        (g) =>
          (g.status === "queued" || g.status === "processing") &&
          new Date(g.created_at).getTime() > cutoff,
      );
      if (flying.length === 0) {
        clearInterval(t);
        return;
      }
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
            onClick={() => selectTab(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm transition ${
              tab === t.id ? "bg-accent font-medium text-accent-ink" : "bg-panel-2 text-mute hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <input
          value={search}
          onChange={(e) => changeSearch(e.target.value)}
          placeholder="Search prompts…"
          className="rounded-xl border border-edge bg-panel px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent"
        />
        <select
          value={model}
          onChange={(e) => selectModel(e.target.value)}
          aria-label="Filter by model"
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
          onChange={(e) => selectProject(e.target.value)}
          aria-label="Filter by project"
          className="rounded-xl border border-edge bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={days}
          onChange={(e) => selectDays(e.target.value)}
          aria-label="Filter by date"
          className="rounded-xl border border-edge bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">All time</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
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
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                disabled={loadingMore}
                onClick={loadMore}
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

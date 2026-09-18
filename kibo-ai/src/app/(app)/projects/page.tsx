"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type ApiProject } from "@/lib/api";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.projects().then((r) => setProjects(r.projects)).catch(() => {});
  }, []);

  async function create() {
    if (!name.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const { project } = await api.createProject(name.trim());
      setProjects((p) => [project, ...p]);
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        <p className="mt-1 text-sm text-mute">Organize generations into campaigns and clients.</p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
        className="flex gap-2"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New project — e.g. DukaPilot Campaign"
          className="min-w-0 flex-1 rounded-xl border border-edge bg-panel px-3 py-2.5 text-sm outline-none placeholder:text-faint focus:border-accent"
        />
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-40"
        >
          Create
        </button>
      </form>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/library?project=${p.id}`}
            className="rounded-2xl border border-edge bg-panel p-4 transition hover:border-faint"
          >
            <p className="font-semibold">{p.name}</p>
            <p className="mt-1 text-xs text-faint">
              Created {new Date(p.created_at).toLocaleDateString()}
            </p>
          </Link>
        ))}
      </div>
      {projects.length === 0 && (
        <div className="rounded-2xl border border-dashed border-edge bg-panel/50 p-10 text-center">
          <p className="font-medium">No projects yet</p>
          <p className="mt-1 text-sm text-mute">Create one above, then assign it when generating.</p>
        </div>
      )}
    </div>
  );
}

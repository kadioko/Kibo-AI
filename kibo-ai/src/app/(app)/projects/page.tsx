"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type ApiProject } from "@/lib/api";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

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

  async function saveRename(id: string) {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    try {
      const { project } = await api.renameProject(id, editName.trim());
      setProjects((prev) => prev.map((p) => (p.id === id ? project : p)));
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rename failed");
    }
  }

  async function remove(id: string, projectName: string) {
    if (!confirm(`Delete “${projectName}”? Its generations stay in your library.`)) return;
    try {
      await api.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
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
          <div
            key={p.id}
            className="rounded-2xl border border-edge bg-panel p-4 transition hover:border-faint"
          >
            {editingId === p.id ? (
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => void saveRename(p.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveRename(p.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="w-full rounded-lg border border-accent bg-panel-2 px-2 py-1 text-sm font-semibold outline-none"
              />
            ) : (
              <Link href={`/library?project=${p.id}`} className="font-semibold hover:text-accent">
                {p.name}
              </Link>
            )}
            <p className="mt-1 text-xs text-faint">
              Created {new Date(p.created_at).toLocaleDateString()}
            </p>
            <div className="mt-2 flex gap-1">
              <button
                type="button"
                onClick={() => {
                  setEditName(p.name);
                  setEditingId(p.id);
                }}
                className="rounded-lg px-2 py-1 text-xs text-mute transition hover:bg-panel-2 hover:text-ink"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => void remove(p.id, p.name)}
                className="rounded-lg px-2 py-1 text-xs text-mute transition hover:bg-panel-2 hover:text-red-300"
              >
                Delete
              </button>
            </div>
          </div>
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

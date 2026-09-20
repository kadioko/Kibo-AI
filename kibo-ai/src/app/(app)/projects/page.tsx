"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, formatUsd, type ApiProject, type ApiTeam } from "@/lib/api";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [teams, setTeams] = useState<ApiTeam[]>([]);
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTeam, setEditTeam] = useState("");

  useEffect(() => {
    api.projects().then((r) => setProjects(r.projects)).catch(() => {});
    api.teams().then((r) => setTeams(r.teams)).catch(() => {});
  }, []);

  async function create() {
    if (!name.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const { project } = await api.createProject(name.trim(), undefined, teamId || null);
      setProjects((p) => [project, ...p]);
      setName("");
      setTeamId("");
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
      const { project } = await api.patchProject(id, {
        name: editName.trim(),
        teamId: editTeam || null,
      });
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...project } : p)),
      );
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
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
        <p className="mt-1 text-sm text-mute">
          Organize work and compare quoted generation cost with completed spend.
        </p>
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
        {teams.length > 0 && (
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            aria-label="Team"
            className="shrink-0 rounded-xl border border-edge bg-panel px-3 py-2.5 text-sm outline-none focus:border-accent"
          >
            <option value="">Personal</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
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
              <div className="space-y-2">
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void saveRename(p.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="w-full rounded-lg border border-accent bg-panel-2 px-2 py-1 text-sm font-semibold outline-none"
                />
                {teams.length > 0 && (
                  <select
                    value={editTeam}
                    onChange={(e) => setEditTeam(e.target.value)}
                    aria-label="Team"
                    className="w-full rounded-lg border border-edge bg-panel-2 px-2 py-1 text-sm outline-none"
                  >
                    <option value="">Personal</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => void saveRename(p.id)}
                    className="rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-accent-ink"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-lg px-2.5 py-1 text-xs text-mute hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <Link href={`/library?project=${p.id}`} className="font-semibold hover:text-accent">
                {p.name}
              </Link>
            )}
            <p className="mt-1 text-xs text-faint">
              {p.team_id ? `Team: ${teams.find((t) => t.id === p.team_id)?.name ?? "shared"}` : "Personal"} ·{" "}
              Created {new Date(p.created_at).toLocaleDateString()}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-edge bg-panel-2 p-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-faint">Estimated total</p>
                <p className="mt-0.5 font-semibold tabular-nums">{formatUsd(p.estimated_cost)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-faint">Final completed</p>
                <p className="mt-0.5 font-semibold tabular-nums text-emerald-300">
                  {formatUsd(p.actual_cost)}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-faint">
              {p.generation_count} generation{p.generation_count === 1 ? "" : "s"}
              {p.active_count > 0 ? ` · ${p.active_count} active` : ""}
              {p.failed_count > 0 ? ` · ${p.failed_count} not charged` : ""}
            </p>
            <div className="mt-2 flex gap-1">
              <button
                type="button"
                onClick={() => {
                  setEditName(p.name);
                  setEditTeam(p.team_id ?? "");
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

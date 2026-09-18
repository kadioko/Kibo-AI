"use client";

import { useEffect, useState } from "react";
import { api, formatUsd, type ApiPendingInvite, type ApiTeam, type CreditSummary } from "@/lib/api";

function shortId(id: string): string {
  return `${id.slice(0, 6)}…`;
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<ApiTeam[]>([]);
  const [pending, setPending] = useState<ApiPendingInvite[]>([]);
  const [wallets, setWallets] = useState<Record<string, CreditSummary>>({});
  const [fundAmount, setFundAmount] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [inviteEmail, setInviteEmail] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);

  async function reload() {
    try {
      const res = await api.teams();
      setTeams(res.teams);
      setPending(res.pendingInvites);
      setMyId(res.me);
    } catch {
      // Not fatal on first paint.
    }
  }

  useEffect(() => {
    api
      .teams()
      .then((res) => {
        setTeams(res.teams);
        setPending(res.pendingInvites);
        setMyId(res.me);
        for (const t of res.teams) {
          api
            .teamWallet(t.id)
            .then((w) => setWallets((prev) => ({ ...prev, [t.id]: w })))
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  async function create() {
    if (!name.trim()) return;
    setError(null);
    try {
      const { team } = await api.createTeam(name.trim());
      setTeams((prev) => [{ ...team, members: [], invites: [] }, ...prev]);
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
  }

  async function invite(teamId: string) {
    const email = (inviteEmail[teamId] ?? "").trim();
    if (!email) return;
    setError(null);
    try {
      const { invite } = await api.inviteMember(teamId, email);
      setTeams((prev) =>
        prev.map((t) => (t.id === teamId ? { ...t, invites: [invite, ...t.invites] } : t)),
      );
      setInviteEmail((prev) => ({ ...prev, [teamId]: "" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invite failed");
    }
  }

  async function accept(teamId: string) {
    try {
      await api.acceptInvite(teamId);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Accept failed");
    }
  }

  async function decline(teamId: string) {
    try {
      await api.declineInvite(teamId);
      setPending((prev) => prev.filter((p) => p.team_id !== teamId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decline failed");
    }
  }

  async function leaveOrRemove(teamId: string, userId: string, isSelf: boolean) {
    if (!confirm(isSelf ? "Leave this team?" : "Remove this member?")) return;
    try {
      await api.removeMember(teamId, userId);
      if (isSelf) setTeams((prev) => prev.filter((t) => t.id !== teamId));
      else await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
    }
  }

  async function removeTeam(teamId: string, teamName: string) {
    if (!confirm(`Delete team “${teamName}”? Its projects become personal.`)) return;
    try {
      await api.deleteTeam(teamId);
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function fund(teamId: string) {
    const amount = Number(fundAmount[teamId] ?? "");
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an amount above $0.");
      return;
    }
    setError(null);
    try {
      await api.fundTeam(teamId, amount);
      const wallet = await api.teamWallet(teamId);
      setWallets((prev) => ({ ...prev, [teamId]: wallet }));
      setFundAmount((prev) => ({ ...prev, [teamId]: "" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Funding failed");
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Teams</h1>
        <p className="mt-1 text-sm text-mute">
          Share projects — teammates see generations filed under team projects.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {pending.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Invites for you</h2>
          {pending.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-4"
            >
              <div>
                <p className="font-medium">{inv.teams?.name ?? "A team"}</p>
                <p className="text-xs text-faint">Invited as {inv.email}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => void accept(inv.team_id)}
                  className="rounded-xl bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => void decline(inv.team_id)}
                  className="rounded-xl border border-edge px-3 py-1.5 text-sm transition hover:border-faint"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </section>
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
          placeholder="New team — e.g. DukaPilot Studio"
          className="min-w-0 flex-1 rounded-xl border border-edge bg-panel px-3 py-2.5 text-sm outline-none placeholder:text-faint focus:border-accent"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-40"
        >
          Create
        </button>
      </form>

      <section className="space-y-3">
        {teams.map((team) => {
          const myMembership = team.members.find((m) => m.user_id === myId);
          const isTeamOwner = myMembership?.role === "owner";
          return (
            <div key={team.id} className="rounded-2xl border border-edge bg-panel p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{team.name}</p>
                  <p className="text-xs text-faint">
                    {team.members.length} member{team.members.length === 1 ? "" : "s"} · wallet{" "}
                    <span className="font-semibold tabular-nums text-ink">
                      {wallets[team.id] ? formatUsd(wallets[team.id].balance) : "…"}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void removeTeam(team.id, team.name)}
                  className="rounded-lg px-2 py-1 text-xs text-mute transition hover:bg-panel-2 hover:text-red-300"
                >
                  Delete team
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void fund(team.id);
                }}
                className="mt-3 flex gap-2"
              >
                <input
                  value={fundAmount[team.id] ?? ""}
                  onChange={(e) => setFundAmount((prev) => ({ ...prev, [team.id]: e.target.value }))}
                  inputMode="decimal"
                  placeholder="Fund wallet ($)"
                  aria-label={`Fund ${team.name} wallet`}
                  className="min-w-0 flex-1 rounded-xl border border-edge bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-xl border border-edge px-3 py-2 text-sm transition hover:border-accent hover:text-accent"
                >
                  Add funds
                </button>
              </form>
              <p className="mt-1.5 text-[11px] text-faint">
                Moves your personal credits into the shared wallet. Team generations spend from
                here; the balance is the cap.
              </p>

              <div className="mt-3 space-y-1.5">
                {team.members.map((m) => (
                  <div key={m.user_id} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs text-mute" title={m.user_id}>
                      {shortId(m.user_id)}
                      {m.user_id === myId && " (you)"}
                      <span className="ml-2 rounded-md bg-panel-2 px-1.5 py-0.5 font-sans">
                        {m.role}
                      </span>
                    </span>
                    {isTeamOwner && m.user_id !== myId && (
                      <button
                        type="button"
                        onClick={() => void leaveOrRemove(team.id, m.user_id, false)}
                        className="rounded-lg px-2 py-0.5 text-xs text-mute transition hover:bg-panel-2 hover:text-red-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void invite(team.id);
                }}
                className="mt-3 flex gap-2"
              >
                <input
                  value={inviteEmail[team.id] ?? ""}
                  onChange={(e) => setInviteEmail((prev) => ({ ...prev, [team.id]: e.target.value }))}
                  placeholder="Invite by email…"
                  type="email"
                  className="min-w-0 flex-1 rounded-xl border border-edge bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-xl border border-edge px-3 py-2 text-sm transition hover:border-accent hover:text-accent"
                >
                  Invite
                </button>
              </form>

              {team.invites.length > 0 && (
                <div className="mt-2 space-y-1">
                  {team.invites.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between text-xs text-faint">
                      <span>Pending: {inv.email}</span>
                      <button
                        type="button"
                        onClick={() =>
                          api
                            .revokeInvite(team.id, inv.id)
                            .then(() =>
                              setTeams((prev) =>
                                prev.map((t) =>
                                  t.id === team.id
                                    ? { ...t, invites: t.invites.filter((v) => v.id !== inv.id) }
                                    : t,
                                ),
                              ),
                            )
                            .catch((e: unknown) =>
                              setError(e instanceof Error ? e.message : "Revoke failed"),
                            )
                        }
                        className="rounded px-1.5 py-0.5 transition hover:bg-panel-2 hover:text-red-300"
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {myId && (
                <button
                  type="button"
                  onClick={() => void leaveOrRemove(team.id, myId, true)}
                  className="mt-3 text-xs text-faint transition hover:text-ink"
                >
                  Leave team
                </button>
              )}
            </div>
          );
        })}
      </section>

      {teams.length === 0 && pending.length === 0 && (
        <div className="rounded-2xl border border-dashed border-edge bg-panel/50 p-10 text-center">
          <p className="font-medium">No teams yet</p>
          <p className="mt-1 text-sm text-mute">Create one above, then invite teammates by email.</p>
        </div>
      )}
    </div>
  );
}

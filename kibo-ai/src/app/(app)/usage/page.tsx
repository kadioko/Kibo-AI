"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, formatUsd } from "@/lib/api";

interface Usage {
  totalSpend: number;
  generations: number;
  monthSpend: number;
  monthlyLimit: number | null;
  byModel: Array<{ model: string; spend: number; count: number }>;
  byDay: Array<{ day: string; spend: number; count: number }>;
  byProject: Array<{ projectId: string; projectName: string; spend: number; count: number }>;
}

export default function UsagePage() {
  const [days, setDays] = useState(30);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Stale-while-revalidate: the previous range stays visible while the new
  // one loads; all state updates happen in async continuations.
  useEffect(() => {
    let live = true;
    api
      .usage(days)
      .then((r) => {
        if (live) setUsage(r.usage);
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : "Failed to load");
      });
    return () => {
      live = false;
    };
  }, [days]);

  const maxDay = Math.max(0.01, ...(usage?.byDay.map((d) => d.spend) ?? [0]));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usage</h1>
          <p className="mt-1 text-sm text-mute">Every dollar tracked, per model and per day.</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-panel-2 p-1 text-sm">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 transition ${
                days === d ? "bg-edge font-medium text-ink" : "text-mute hover:text-ink"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-edge bg-panel p-4">
          <p className="text-2xl font-bold tabular-nums">
            {usage ? formatUsd(usage.totalSpend) : "…"}
          </p>
          <p className="mt-1 text-xs text-mute">Total spend · last {days} days</p>
        </div>
        <div className="rounded-2xl border border-edge bg-panel p-4">
          <p className="text-2xl font-bold tabular-nums">{usage ? usage.generations : "…"}</p>
          <p className="mt-1 text-xs text-mute">Billed generations</p>
        </div>
      </div>

      <section className="rounded-2xl border border-edge bg-panel p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-semibold">This month</h2>
          <p className="text-sm tabular-nums">
            {usage ? (
              <>
                {formatUsd(usage.monthSpend)}
                {usage.monthlyLimit != null && (
                  <span className="text-faint"> / {formatUsd(usage.monthlyLimit)}</span>
                )}
              </>
            ) : (
              "…"
            )}
          </p>
        </div>
        {usage?.monthlyLimit != null ? (
          <>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-panel-2"
              role="progressbar"
              aria-valuenow={Math.round((usage.monthSpend / usage.monthlyLimit) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Monthly budget used"
            >
              <div
                className={`h-full rounded-full transition-all ${
                  usage.monthSpend >= usage.monthlyLimit ? "bg-red-400" : "bg-accent"
                }`}
                style={{ width: `${Math.min(100, (usage.monthSpend / usage.monthlyLimit) * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-faint">
              {usage.monthSpend >= usage.monthlyLimit
                ? "Limit reached — new generations are blocked until you raise it in Settings."
                : `${Math.round((usage.monthSpend / usage.monthlyLimit) * 100)}% of budget used.`}{" "}
              <Link href="/settings" className="underline hover:text-ink">Manage</Link>
            </p>
          </>
        ) : (
          <p className="text-sm text-mute">
            No monthly cap.{" "}
            <Link href="/settings" className="underline hover:text-ink">Set one in Settings</Link>{" "}
            to block runaway spend.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-edge bg-panel p-4">
        <h2 className="mb-3 font-semibold">Spend by day</h2>
        {!usage ? (
          <div className="h-28 animate-pulse rounded-xl bg-panel-2" />
        ) : usage.byDay.length === 0 ? (
          <p className="py-6 text-center text-sm text-mute">No spend in this period yet.</p>
        ) : (
          <div className="flex h-28 items-end gap-1">
            {usage.byDay.map((d) => (
              <div
                key={d.day}
                title={`${d.day}: ${formatUsd(d.spend)} (${d.count})`}
                className="min-w-0 flex-1 rounded-t bg-accent/70 transition hover:bg-accent"
                style={{ height: `${Math.max(4, (d.spend / maxDay) * 100)}%` }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-edge bg-panel p-4">
        <h2 className="mb-3 font-semibold">Spend by model</h2>
        {!usage ? (
          <div className="h-20 animate-pulse rounded-xl bg-panel-2" />
        ) : usage.byModel.length === 0 ? (
          <p className="py-6 text-center text-sm text-mute">No spend in this period yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-faint">
                  <th className="pb-2 pr-4 font-medium">Model</th>
                  <th className="pb-2 pr-4 text-right font-medium">Generations</th>
                  <th className="pb-2 text-right font-medium">Spend</th>
                </tr>
              </thead>
              <tbody>
                {usage.byModel.map((m) => (
                  <tr key={m.model} className="border-t border-edge">
                    <td className="py-2.5 pr-4">{m.model}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{m.count}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatUsd(m.spend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="rounded-2xl border border-edge bg-panel p-4">
        <h2 className="mb-3 font-semibold">Spend by project</h2>
        {!usage ? (
          <div className="h-20 animate-pulse rounded-xl bg-panel-2" />
        ) : usage.byProject.length === 0 ? (
          <p className="py-6 text-center text-sm text-mute">
            No project spend in this period yet — assign a project when generating.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-faint">
                  <th className="pb-2 pr-4 font-medium">Project</th>
                  <th className="pb-2 pr-4 text-right font-medium">Generations</th>
                  <th className="pb-2 text-right font-medium">Spend</th>
                </tr>
              </thead>
              <tbody>
                {usage.byProject.map((p) => (
                  <tr key={p.projectId} className="border-t border-edge">
                    <td className="py-2.5 pr-4">
                      <Link href={`/library?project=${p.projectId}`} className="hover:text-accent">
                        {p.projectName}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{p.count}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatUsd(p.spend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

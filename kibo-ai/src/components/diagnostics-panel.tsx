"use client";

import { useEffect, useState } from "react";

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export function DiagnosticsPanel() {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then(async (r) => {
        const json = (await r.json()) as { checks?: Check[]; error?: string };
        if (!r.ok) throw new Error(json.error ?? "Health check failed");
        setChecks(json.checks ?? []);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (!checks) return <div className="h-24 animate-pulse rounded-xl bg-panel-2" />;

  return (
    <ul className="space-y-2">
      {checks.map((c) => (
        <li
          key={c.name}
          className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${
            c.ok ? "border-edge bg-panel-2" : "border-red-500/30 bg-red-500/5"
          }`}
        >
          <span aria-hidden>{c.ok ? "✓" : "✕"}</span>
          <span>
            <span className="font-medium">{c.name}</span>
            <span className="block text-xs text-mute">{c.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

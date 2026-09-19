"use client";

import { useState } from "react";
import type { AdminUser } from "@/lib/admin";

export function AdminCreditGrant({ users }: { users: AdminUser[] }) {
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [amount, setAmount] = useState("25");
  const [note, setNote] = useState("Support credit");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const amountUsd = Number(amount);
    if (!userId || !Number.isFinite(amountUsd) || amountUsd <= 0) {
      setMessage("Choose a user and enter a positive credit amount.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, amountUsd, note }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Credit grant failed.");
      setMessage("Credits granted and recorded in the audit log.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Credit grant failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-edge bg-panel p-4">
      <div>
        <h2 className="font-semibold">Grant credits</h2>
        <p className="mt-1 text-xs text-mute">Every grant is recorded with your administrator ID and a note.</p>
      </div>
      <label className="block text-sm text-mute">
        User
        <select value={userId} onChange={(event) => setUserId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-edge bg-panel-2 px-3 py-2 text-ink">
          {users.map((user) => (
            <option key={user.id} value={user.id}>{user.email ?? user.id}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm text-mute">
        Amount (USD credits)
        <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" className="mt-1.5 w-full rounded-xl border border-edge bg-panel-2 px-3 py-2 text-ink" />
      </label>
      <label className="block text-sm text-mute">
        Reason
        <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={240} className="mt-1.5 w-full rounded-xl border border-edge bg-panel-2 px-3 py-2 text-ink" />
      </label>
      {message && <p role="status" className="text-sm text-accent">{message}</p>}
      <button disabled={saving || users.length === 0} className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50">
        {saving ? "Granting…" : "Grant credits"}
      </button>
    </form>
  );
}

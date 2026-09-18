import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/auth-actions";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-mute">Account and workspace preferences.</p>
      </div>

      <section className="rounded-2xl border border-edge bg-panel p-5">
        <h2 className="font-semibold">Account</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-mute">Email</dt>
            <dd className="truncate">{user?.email ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-mute">User ID</dt>
            <dd className="truncate font-mono text-xs">{user?.id ?? "—"}</dd>
          </div>
        </dl>
        <form action={signOut} className="mt-4">
          <button
            type="submit"
            className="rounded-xl border border-edge px-4 py-2 text-sm transition hover:border-red-400 hover:text-red-300"
          >
            Log out
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-edge bg-panel p-5">
        <h2 className="font-semibold">Cost control</h2>
        <p className="mt-2 text-sm text-mute">
          Spending limits and budgets arrive in Phase 2. Today every generation shows its
          estimated cost before you submit, and the Usage page tracks real spend.
        </p>
      </section>
    </div>
  );
}

import { resetPassword, signIn, signUp } from "@/lib/auth-actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const mode = params.mode === "signup" || params.mode === "reset" ? params.mode : "login";

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-xl font-black text-accent-ink">
            K
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Kibo AI</h1>
          <p className="mt-1 text-sm text-mute">Your AI creative studio</p>
        </div>

        <div className="rounded-2xl border border-edge bg-panel p-6">
          <div className="mb-5 grid grid-cols-3 gap-1 rounded-xl bg-panel-2 p-1 text-sm">
            {(
              [
                ["login", "Log in"],
                ["signup", "Sign up"],
                ["reset", "Reset"],
              ] as const
            ).map(([m, label]) => (
              <a
                key={m}
                href={`/login${m === "login" ? "" : `?mode=${m}`}`}
                className={`rounded-lg px-3 py-2 text-center transition ${
                  mode === m ? "bg-edge font-medium text-ink" : "text-mute hover:text-ink"
                }`}
              >
                {label}
              </a>
            ))}
          </div>

          {params.error && (
            <p role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {params.error}
            </p>
          )}
          {params.notice && (
            <p role="status" className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">
              {params.notice}
            </p>
          )}

          {mode === "reset" ? (
            <form action={resetPassword} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm text-mute">Email</span>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="you@studio.com"
                  className="w-full rounded-xl border border-edge bg-panel-2 px-3 py-2.5 text-sm outline-none placeholder:text-faint focus:border-accent"
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-accent-ink transition hover:brightness-110"
              >
                Send reset link
              </button>
            </form>
          ) : (
            <form action={mode === "signup" ? signUp : signIn} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm text-mute">Email</span>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="you@studio.com"
                  className="w-full rounded-xl border border-edge bg-panel-2 px-3 py-2.5 text-sm outline-none placeholder:text-faint focus:border-accent"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-mute">Password</span>
                <input
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-edge bg-panel-2 px-3 py-2.5 text-sm outline-none placeholder:text-faint focus:border-accent"
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-accent-ink transition hover:brightness-110"
              >
                {mode === "signup" ? "Create account" : "Log in"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-faint">
          Generate images and videos with frontier AI models.
        </p>
      </div>
    </div>
  );
}

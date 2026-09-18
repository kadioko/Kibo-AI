"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/lib/auth-actions";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "◧" },
  { href: "/create", label: "Create", icon: "✦" },
  { href: "/projects", label: "Projects", icon: "▦" },
  { href: "/teams", label: "Teams", icon: "⊞" },
  { href: "/library", label: "Library", icon: "▤" },
  { href: "/templates", label: "Templates", icon: "⧉" },
  { href: "/brands", label: "Brands", icon: "❖" },
  { href: "/models", label: "Models", icon: "⬡" },
  { href: "/usage", label: "Usage", icon: "$" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export function AppShell({ email, children }: { email?: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="space-y-1">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
              active
                ? "bg-panel-2 font-medium text-ink"
                : "text-mute hover:bg-panel-2/60 hover:text-ink"
            }`}
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm ${
                active ? "bg-accent text-accent-ink" : "bg-panel-2 text-mute"
              }`}
              aria-hidden
            >
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-full">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-edge bg-panel/60 p-4 md:flex">
        <Link href="/dashboard" className="mb-6 flex items-center gap-2.5 px-2 pt-1">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-lg font-black text-accent-ink">
            K
          </span>
          <span className="text-lg font-bold tracking-tight">Kibo AI</span>
        </Link>
        <div className="flex-1 overflow-y-auto kibo-scroll">{nav}</div>
        <div className="border-t border-edge pt-3">
          <p className="truncate px-2 text-xs text-faint">{email}</p>
          <form action={signOut}>
            <button
              type="submit"
              className="mt-1 w-full rounded-xl px-2 py-2 text-left text-sm text-mute transition hover:bg-panel-2/60 hover:text-ink"
            >
              Log out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-edge bg-void/90 px-4 py-3 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-edge bg-panel text-lg"
          >
            ☰
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-sm font-black text-accent-ink">
              K
            </span>
            <span className="font-bold tracking-tight">Kibo AI</span>
          </Link>
        </header>
        {open && (
          <div className="border-b border-edge bg-panel p-4 md:hidden">
            {nav}
            <form action={signOut} className="mt-2 border-t border-edge pt-2">
              <button type="submit" className="w-full rounded-xl px-3 py-2 text-left text-sm text-mute">
                Log out ({email})
              </button>
            </form>
          </div>
        )}
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

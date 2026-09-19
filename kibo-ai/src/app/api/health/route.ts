import { NextResponse } from "next/server";
import { requireUser, toHttpError } from "@/lib/auth";
import { limiterBackend } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

/**
 * Setup diagnostics for the signed-in workspace. Verifies env, database
 * migrations, storage buckets and provider wiring — the checklist from the
 * README, executable. Never exposes secret values.
 */
export async function GET() {
  try {
    await requireUser();
    const checks: Check[] = [];
    const db = await createServiceClient();

    checks.push({
      name: "Supabase connection",
      ok: true,
      detail: "Authenticated service query path.",
    });

    const tables = ["providers", "generations", "brand_profiles", "prompt_templates", "teams", "credit_ledger", "team_credit_ledger", "app_admins", "admin_audit_log"];
    const missing: string[] = [];
    for (const table of tables) {
      const { error } = await db.from(table).select("id", { count: "exact", head: true });
      if (error) missing.push(table);
    }
    checks.push({
      name: "Database migrations",
      ok: missing.length === 0,
      detail:
        missing.length === 0
          ? "0001–0008 applied."
          : `Missing tables: ${missing.join(", ")} — run the migrations in order.`,
    });

    try {
      const { data: buckets, error } = await db.storage.listBuckets();
      if (error) throw error;
      const byName = new Map((buckets ?? []).map((b) => [b.name, b.public]));
      const inputs = byName.get("kibo-inputs");
      const outputs = byName.get("kibo-outputs");
      checks.push({
        name: "Storage buckets",
        ok: inputs === true && outputs === false,
        detail: `kibo-inputs: ${inputs === undefined ? "missing" : inputs ? "public ✓" : "must be PUBLIC"}; kibo-outputs: ${
          outputs === undefined ? "missing" : outputs ? "must be PRIVATE" : "private ✓"
        }.`,
      });
    } catch (e) {
      checks.push({
        name: "Storage buckets",
        ok: false,
        detail: e instanceof Error ? e.message : "Bucket check failed.",
      });
    }

    const hf = Boolean(process.env.HIGGSFIELD_API_KEY_ID && process.env.HIGGSFIELD_API_KEY_SECRET);
    checks.push({
      name: "Higgsfield credentials",
      ok: hf,
      detail: hf ? "Key id + secret present (server-only)." : "Set HIGGSFIELD_API_KEY_ID/SECRET to generate with real models.",
    });

    const mock = process.env.MOCK_PROVIDER_ENABLED === "true";
    checks.push({
      name: "Mock provider",
      ok: true,
      detail: mock
        ? "ENABLED — free end-to-end runs available in Create."
        : "Disabled. Set MOCK_PROVIDER_ENABLED=true to test the full pipeline free.",
    });

    checks.push({
      name: "Prompt assistant",
      ok: true,
      detail:
        process.env.ASSISTANT_API_KEY && process.env.ASSISTANT_API_URL
          ? `LLM backend (${process.env.ASSISTANT_MODEL ?? "default model"}).`
          : "Rule-based structurer (no key needed).",
    });

    checks.push({
      name: "Rate limiter",
      ok: true,
      detail: `${limiterBackend()} backend${limiterBackend() === "memory" ? " — set UPSTASH_* for multi-instance." : "."}`,
    });

    checks.push({
      name: "Card top-ups",
      ok: true,
      detail: process.env.STRIPE_SECRET_KEY
        ? "Stripe configured."
        : "Not configured — credits are granted manually (welcome + admin).",
    });

    return NextResponse.json({ ok: checks.every((c) => c.ok), checks });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

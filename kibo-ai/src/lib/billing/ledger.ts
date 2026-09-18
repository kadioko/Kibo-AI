import { createServiceClient } from "../supabase/server";
import type { Billing, CreditSummary, LedgerEntry } from "./types";

type Db = Awaited<ReturnType<typeof createServiceClient>>;

function welcomeAmount(): number {
  const raw = Number(process.env.WELCOME_CREDITS_USD ?? 5);
  return Number.isFinite(raw) && raw > 0 ? raw : 5;
}

function httpError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status });
}

async function totals(db: Db, userId: string): Promise<{ granted: number; spent: number }> {
  const { data } = await db.from("credit_ledger").select("amount").eq("user_id", userId);
  let granted = 0;
  let spent = 0;
  for (const row of ((data ?? []) as Array<{ amount: number }>)) {
    const n = Number(row.amount);
    if (n >= 0) granted += n;
    else spent += -n;
  }
  return { granted, spent };
}

/** Ledger-backed billing: every grant/spend is an auditable row. */
export function createLedgerBilling(): Billing {
  async function ensureWelcome(db: Db, userId: string) {
    const amount = welcomeAmount();
    if (amount <= 0) return;
    // Partial unique index (user_id WHERE reason='welcome') makes this
    // race-safe: concurrent grants collapse to one row.
    const { error } = await db.from("credit_ledger").insert({
      user_id: userId,
      amount,
      reason: "welcome",
      generation_id: null,
    });
    if (error && !/duplicate|unique/i.test(error.message)) {
      throw new Error(`Welcome grant failed: ${error.message}`);
    }
  }

  return {
    id: "ledger",

    async balance(userId: string): Promise<CreditSummary> {
      const db = await createServiceClient();
      await ensureWelcome(db, userId);
      const { granted, spent } = await totals(db, userId);
      return {
        balance: Math.round((granted - spent) * 100) / 100,
        lifetimeGranted: Math.round(granted * 100) / 100,
        lifetimeSpent: Math.round(spent * 100) / 100,
      };
    },

    async checkSufficient(userId: string, estimateUsd: number): Promise<void> {
      const summary = await this.balance(userId);
      if (summary.balance < estimateUsd) {
        throw httpError(
          402,
          `Insufficient credits ($${summary.balance.toFixed(2)} left, need $${estimateUsd.toFixed(2)}). Top up to continue.`,
        );
      }
    },

    async spend(userId: string, generationId: string | null, amountUsd: number): Promise<void> {
      if (!(amountUsd > 0)) return;
      const db = await createServiceClient();
      const { error } = await db.from("credit_ledger").insert({
        user_id: userId,
        amount: -Math.round(amountUsd * 100) / 100,
        reason: "generation",
        generation_id: generationId,
      });
      if (error) throw new Error(`Spend failed: ${error.message}`);
    },

    async grant(userId: string, amountUsd: number, reason: string): Promise<void> {
      if (!(amountUsd > 0)) throw new Error("Grant amount must be positive");
      const db = await createServiceClient();
      const { error } = await db.from("credit_ledger").insert({
        user_id: userId,
        amount: Math.round(amountUsd * 100) / 100,
        reason,
        generation_id: null,
      });
      if (error) throw new Error(`Grant failed: ${error.message}`);
    },

    async recent(userId: string, limit = 20): Promise<LedgerEntry[]> {
      const db = await createServiceClient();
      await ensureWelcome(db, userId);
      const { data, error } = await db
        .from("credit_ledger")
        .select("id,amount,reason,generation_id,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(`Ledger query failed: ${error.message}`);
      return (data ?? []) as LedgerEntry[];
    },
  };
}

let billing: Billing | null = null;

/** Singleton — swap for a different Billing to change the money layer. */
export function getBilling(): Billing {
  billing ??= createLedgerBilling();
  return billing;
}

/**
 * Billing abstraction. The ledger is the source of truth (1 credit = $1 of
 * provider spend); payment providers (Stripe, …) only append grants.
 */

export interface CreditSummary {
  balance: number;
  lifetimeGranted: number;
  lifetimeSpent: number;
}

export interface LedgerEntry {
  id: string;
  amount: number;
  reason: string;
  generation_id: string | null;
  created_at: string;
}

export interface Billing {
  readonly id: string;
  /** Current balance, granting the welcome credits on first read. */
  balance(userId: string): Promise<CreditSummary>;
  /** Throw 402 when the balance cannot cover the estimate. */
  checkSufficient(userId: string, estimateUsd: number): Promise<void>;
  /** Record completed-generation spend. */
  spend(userId: string, generationId: string | null, amountUsd: number): Promise<void>;
  /** Append a grant (welcome, top-up, admin). */
  grant(userId: string, amountUsd: number, reason: string): Promise<void>;
  recent(userId: string, limit?: number): Promise<LedgerEntry[]>;

  /** Team wallet balance (no welcome grant — teams start at zero). */
  teamBalance(teamId: string): Promise<CreditSummary>;
  /** Throw 402 when the team wallet cannot cover the estimate. */
  checkTeamSufficient(teamId: string, estimateUsd: number): Promise<void>;
  /** Record completed-generation spend against the team wallet. */
  spendTeam(teamId: string, generationId: string | null, amountUsd: number): Promise<void>;
  /** Move personal credits into a team wallet (compensating on failure). */
  fundTeam(userId: string, teamId: string, amountUsd: number): Promise<void>;
  recentTeam(teamId: string, limit?: number): Promise<LedgerEntry[]>;
}

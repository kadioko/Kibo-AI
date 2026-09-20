export const databaseTables = [
  { name: "providers", column: "id" },
  { name: "models", column: "id" },
  { name: "projects", column: "id,team_id" },
  { name: "generations", column: "id,team_id,brand_id,template_id" },
  { name: "generation_assets", column: "id" },
  { name: "favorites", column: "generation_id" },
  { name: "brand_profiles", column: "id" },
  { name: "prompt_templates", column: "id" },
  { name: "spending_limits", column: "user_id" },
  { name: "teams", column: "id" },
  { name: "team_members", column: "user_id" },
  { name: "team_invites", column: "id" },
  { name: "credit_ledger", column: "id" },
  { name: "team_credit_ledger", column: "id" },
  { name: "app_admins", column: "user_id" },
  { name: "admin_audit_log", column: "id" },
  { name: "model_favorites", column: "model_id" },
] as const;

interface DatabaseCheck {
  name: string;
  error: { code?: string; message: string } | null;
}

/** A denied query does not mean a table is missing. Never print credentials. */
export function summarizeDatabaseChecks(results: DatabaseCheck[]) {
  const missing: string[] = [];
  const denied: string[] = [];
  const columns: string[] = [];
  const failed: string[] = [];
  for (const { name, error } of results) {
    if (!error) continue;
    if (error.code === "42P01" || error.code === "PGRST205") missing.push(name);
    else if (error.code === "42501") denied.push(name);
    else if (error.code === "42703" || error.code === "PGRST204") columns.push(name);
    else failed.push(name);
  }
  const details: string[] = [];
  if (missing.length) details.push(`Missing tables: ${missing.join(", ")} — apply the pending database migrations.`);
  if (denied.length) details.push(`Permission denied: ${denied.join(", ")} — apply the runtime privilege migrations and verify the server credential.`);
  if (columns.length) details.push(`Missing columns in: ${columns.join(", ")} — apply the pending database migrations.`);
  if (failed.length) details.push(`Could not verify: ${failed.join(", ")} — check the database connection and server configuration.`);
  return {
    ok: details.length === 0,
    detail: details.length ? details.join(" ") : "Required tables and columns are accessible.",
  };
}

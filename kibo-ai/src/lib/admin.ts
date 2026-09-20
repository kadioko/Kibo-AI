import { requireUser } from "./auth";
import { createServiceClient } from "./supabase/server";

export interface AdminUser {
  id: string;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
}

export interface AdminOverview {
  users: AdminUser[];
  userCount: number;
  generationCount: number;
  activeGenerationCount: number;
  spendLast30Days: number;
  recentGenerations: Array<{
    id: string;
    userId: string;
    model: string;
    type: string;
    status: string;
    estimatedCost: number | null;
    actualCost: number | null;
    createdAt: string;
  }>;
}

function forbidden() {
  return Object.assign(new Error("Administrator access required."), { status: 403 });
}

/** Fail closed. This must be used before every privileged operation. */
export async function isAppAdmin(userId: string): Promise<boolean> {
  const db = await createServiceClient();
  const { data, error } = await db
    .from("app_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !error && Boolean(data);
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!(await isAppAdmin(user.id))) throw forbidden();
  return user;
}

export async function writeAdminAudit(
  adminId: string,
  action: string,
  targetUserId: string | null,
  metadata: Record<string, unknown> = {},
) {
  const db = await createServiceClient();
  const { error } = await db.from("admin_audit_log").insert({
    admin_id: adminId,
    action,
    target_user_id: targetUserId,
    metadata,
  });
  if (error) throw new Error(`Admin audit write failed: ${error.message}`);
}

export async function getAdminOverview(): Promise<AdminOverview> {
  await requireAdmin();
  const db = await createServiceClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
  const [usersResult, generationResult, activeResult, spendResult, recentResult] = await Promise.all([
    db.auth.admin.listUsers({ page: 1, perPage: 100 }),
    db.from("generations").select("id", { count: "exact", head: true }),
    db.from("generations").select("id", { count: "exact", head: true }).in("status", ["queued", "processing"]),
    db.from("usage_logs").select("cost_usd").gte("created_at", since),
    db
      .from("generations")
      .select("id,user_id,model,generation_type,status,estimated_cost,actual_cost,created_at")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  if (usersResult.error) throw new Error(`User query failed: ${usersResult.error.message}`);
  if (generationResult.error) throw new Error(`Generation count failed: ${generationResult.error.message}`);
  if (activeResult.error) throw new Error(`Active generation count failed: ${activeResult.error.message}`);
  if (spendResult.error) throw new Error(`Usage query failed: ${spendResult.error.message}`);
  if (recentResult.error) throw new Error(`Recent generation query failed: ${recentResult.error.message}`);

  const users = usersResult.data.users.map((user) => ({
    id: user.id,
    email: user.email ?? null,
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
  }));
  const spendLast30Days = (spendResult.data ?? []).reduce(
    (total, row) => total + Number((row as { cost_usd: number }).cost_usd),
    0,
  );

  return {
    users,
    userCount: users.length,
    generationCount: generationResult.count ?? 0,
    activeGenerationCount: activeResult.count ?? 0,
    spendLast30Days: Math.round(spendLast30Days * 100) / 100,
    recentGenerations: (recentResult.data ?? []).map((row) => {
      const item = row as {
        id: string;
        user_id: string;
        model: string;
        generation_type: string;
        status: string;
        estimated_cost: number | null;
        actual_cost: number | null;
        created_at: string;
      };
      return {
        id: item.id,
        userId: item.user_id,
        model: item.model,
        type: item.generation_type,
        status: item.status,
        estimatedCost: item.estimated_cost,
        actualCost: item.actual_cost,
        createdAt: item.created_at,
      };
    }),
  };
}

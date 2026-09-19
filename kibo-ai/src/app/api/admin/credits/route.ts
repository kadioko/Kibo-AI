import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, writeAdminAudit } from "@/lib/admin";
import { toHttpError } from "@/lib/auth";
import { getBilling } from "@/lib/billing/ledger";
import { createServiceClient } from "@/lib/supabase/server";

const grantSchema = z.object({
  userId: z.string().uuid(),
  amountUsd: z.number().finite().positive().max(100_000),
  note: z.string().trim().min(3).max(240).optional(),
});

/** Grant prepaid credits through an auditable, admin-only path. */
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const parsed = grantSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid grant", issues: parsed.error.issues }, { status: 400 });
    }
    const { userId, amountUsd, note } = parsed.data;
    const db = await createServiceClient();
    const { data, error } = await db.auth.admin.getUserById(userId);
    if (error || !data.user) return NextResponse.json({ error: "User not found." }, { status: 404 });

    await getBilling().grant(userId, amountUsd, `admin_grant:${note ?? "manual"}`);
    await writeAdminAudit(admin.id, "credit_grant", userId, { amountUsd, note: note ?? null });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

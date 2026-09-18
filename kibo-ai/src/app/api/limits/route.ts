import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, toHttpError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { data } = await supabase
      .from("spending_limits")
      .select("monthly_limit_usd")
      .eq("user_id", user.id)
      .maybeSingle();
    return NextResponse.json({
      limit: (data as { monthly_limit_usd: number } | null)?.monthly_limit_usd ?? null,
    });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

const putSchema = z.object({
  monthlyLimitUsd: z.number().positive().max(100000).nullable(),
});

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const parsed = putSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const supabase = await createClient();
    if (parsed.data.monthlyLimitUsd === null) {
      await supabase.from("spending_limits").delete().eq("user_id", user.id);
      return NextResponse.json({ limit: null });
    }
    const { error } = await supabase.from("spending_limits").upsert(
      { user_id: user.id, monthly_limit_usd: parsed.data.monthlyLimitUsd },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ limit: parsed.data.monthlyLimitUsd });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

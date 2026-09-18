import { NextResponse } from "next/server";
import { requireUser, toHttpError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    await requireUser();
    const days = Math.min(
      90,
      Math.max(1, Number(new URL(request.url).searchParams.get("days") ?? 30)),
    );
    const since = new Date();
    since.setDate(since.getDate() - days);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("usage_logs")
      .select("cost_usd,model,project_id,created_at,generation_id")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{
      cost_usd: number;
      model: string;
      project_id: string | null;
      created_at: string;
    }>;

    const byModel = new Map<string, { spend: number; count: number }>();
    const byDay = new Map<string, { spend: number; count: number }>();
    let totalSpend = 0;
    for (const r of rows) {
      const cost = Number(r.cost_usd);
      totalSpend += cost;
      const m = byModel.get(r.model) ?? { spend: 0, count: 0 };
      m.spend += cost;
      m.count += 1;
      byModel.set(r.model, m);
      const day = r.created_at.slice(0, 10);
      const d = byDay.get(day) ?? { spend: 0, count: 0 };
      d.spend += cost;
      d.count += 1;
      byDay.set(day, d);
    }
    const round = (n: number) => Math.round(n * 100) / 100;
    return NextResponse.json({
      usage: {
        totalSpend: round(totalSpend),
        generations: rows.length,
        byModel: [...byModel.entries()]
          .map(([model, v]) => ({ model, spend: round(v.spend), count: v.count }))
          .sort((a, b) => b.spend - a.spend),
        byDay: [...byDay.entries()]
          .map(([day, v]) => ({ day, spend: round(v.spend), count: v.count }))
          .sort((a, b) => (a.day < b.day ? -1 : 1)),
      },
    });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

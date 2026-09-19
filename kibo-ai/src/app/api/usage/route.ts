import { NextResponse } from "next/server";
import { requireUser, toHttpError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const days = Math.min(
      90,
      Math.max(1, Number(new URL(request.url).searchParams.get("days") ?? 30)),
    );
    const since = new Date();
    since.setDate(since.getDate() - days);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const supabase = await createClient();

    const [{ data, error }, { data: projects, error: projectsError }, { data: monthLogs, error: monthLogsError }, { data: limit, error: limitError }] =
      await Promise.all([
        supabase
          .from("usage_logs")
          .select("cost_usd,model,project_id,created_at")
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: true }),
        supabase.from("projects").select("id,name"),
        supabase
          .from("usage_logs")
          .select("cost_usd")
          .gte("created_at", monthStart.toISOString()),
        supabase
          .from("spending_limits")
          .select("monthly_limit_usd")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
    if (error) throw new Error(error.message);
    if (projectsError) throw new Error(projectsError.message);
    if (monthLogsError) throw new Error(monthLogsError.message);
    if (limitError) throw new Error(limitError.message);
    const rows = (data ?? []) as Array<{
      cost_usd: number;
      model: string;
      project_id: string | null;
      created_at: string;
    }>;
    const projectNames = new Map(
      ((projects ?? []) as Array<{ id: string; name: string }>).map((p) => [p.id, p.name]),
    );

    const byModel = new Map<string, { spend: number; count: number }>();
    const byDay = new Map<string, { spend: number; count: number }>();
    const byProject = new Map<string, { spend: number; count: number }>();
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
      if (r.project_id) {
        const p = byProject.get(r.project_id) ?? { spend: 0, count: 0 };
        p.spend += cost;
        p.count += 1;
        byProject.set(r.project_id, p);
      }
    }
    const round = (n: number) => Math.round(n * 100) / 100;
    const monthSpend = ((monthLogs ?? []) as Array<{ cost_usd: number }>).reduce(
      (sum, r) => sum + Number(r.cost_usd),
      0,
    );
    return NextResponse.json({
      usage: {
        totalSpend: round(totalSpend),
        generations: rows.length,
        monthSpend: round(monthSpend),
        monthlyLimit:
          (limit as { monthly_limit_usd: number } | null)?.monthly_limit_usd ?? null,
        byModel: [...byModel.entries()]
          .map(([model, v]) => ({ model, spend: round(v.spend), count: v.count }))
          .sort((a, b) => b.spend - a.spend),
        byDay: [...byDay.entries()]
          .map(([day, v]) => ({ day, spend: round(v.spend), count: v.count }))
          .sort((a, b) => (a.day < b.day ? -1 : 1)),
        byProject: [...byProject.entries()]
          .map(([projectId, v]) => ({
            projectId,
            projectName: projectNames.get(projectId) ?? "Deleted project",
            spend: round(v.spend),
            count: v.count,
          }))
          .sort((a, b) => b.spend - a.spend),
      },
    });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, toHttpError } from "@/lib/auth";
import {
  emptyProjectCostSummary,
  summarizeProjectCosts,
  type ProjectGenerationCost,
} from "@/lib/projects/costs";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    await requireUser();
    const supabase = await createClient();
    const projectsResult = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (projectsResult.error) throw new Error(projectsResult.error.message);

    // PostgREST defaults to a 1,000-row response cap. Page explicitly so old
    // projects do not silently under-report their totals as the library grows.
    const generationCosts: ProjectGenerationCost[] = [];
    const pageSize = 1_000;
    for (let from = 0; ; from += pageSize) {
      const page = await supabase
        .from("generations")
        .select("project_id,status,estimated_cost,actual_cost")
        .not("project_id", "is", null)
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (page.error) throw new Error(page.error.message);
      const rows = (page.data ?? []) as ProjectGenerationCost[];
      generationCosts.push(...rows);
      if (rows.length < pageSize) break;
    }
    const totals = summarizeProjectCosts(generationCosts);
    const projects = (projectsResult.data ?? []).map((project) => ({
      ...project,
      ...(totals.get(project.id) ?? emptyProjectCostSummary()),
    }));
    return NextResponse.json({ projects });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  teamId: z.string().uuid().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const json = await request.json();
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const supabase = await createClient();
    // RLS (projects_insert) rejects team_ids the user is not a member of.
    const { data, error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        team_id: parsed.data.teamId ?? null,
      })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? "Create failed");
    return NextResponse.json(
      { project: { ...data, ...emptyProjectCostSummary() } },
      { status: 201 },
    );
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

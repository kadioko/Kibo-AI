import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, toHttpError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const templateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  promptStructure: z.string().trim().min(1).max(5000),
  aspectRatio: z.string().trim().max(16).optional(),
  recommendedModels: z.array(z.string().max(128)).max(10).default([]),
  durationSeconds: z.number().positive().max(120).optional(),
});

export async function GET() {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("prompt_templates")
      .select("*")
      .order("is_public", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json({ templates: data ?? [] });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

function toRow(t: z.infer<typeof templateSchema>, userId: string) {
  return {
    user_id: userId,
    name: t.name,
    description: t.description || null,
    prompt_structure: t.promptStructure,
    aspect_ratio: t.aspectRatio || null,
    recommended_models: t.recommendedModels,
    duration_seconds: t.durationSeconds ?? null,
    is_public: false,
  };
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = templateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
    }
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("prompt_templates")
      .insert(toRow(parsed.data, user.id))
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? "Create failed");
    return NextResponse.json({ template: data }, { status: 201 });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

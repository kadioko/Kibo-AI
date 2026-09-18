import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, toHttpError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json({ projects: data ?? [] });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const json = await request.json();
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
      })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? "Create failed");
    return NextResponse.json({ project: data }, { status: 201 });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

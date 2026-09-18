import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, toHttpError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  website: z.string().trim().max(255).nullable().optional(),
  logoUrl: z.string().trim().max(2048).nullable().optional(),
  colors: z.array(z.string().max(32)).max(12).optional(),
  industry: z.string().trim().max(120).nullable().optional(),
  targetAudience: z.string().trim().max(500).nullable().optional(),
  visualStyle: z.string().trim().max(500).nullable().optional(),
  adTone: z.string().trim().max(500).nullable().optional(),
  defaultCta: z.string().trim().max(200).nullable().optional(),
});

const COLUMN_MAP: Record<string, string> = {
  logoUrl: "logo_url",
  targetAudience: "target_audience",
  visualStyle: "visual_style",
  adTone: "ad_tone",
  defaultCta: "default_cta",
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      patch[COLUMN_MAP[key] ?? key] = value === "" ? null : value;
    }
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("brand_profiles")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }
    return NextResponse.json({ brand: data });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    const supabase = await createClient();
    const { error } = await supabase.from("brand_profiles").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

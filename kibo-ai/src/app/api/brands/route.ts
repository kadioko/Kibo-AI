import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, toHttpError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const brandSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  website: z.string().trim().max(255).optional(),
  logoUrl: z.string().trim().max(2048).optional(),
  colors: z.array(z.string().max(32)).max(12).default([]),
  industry: z.string().trim().max(120).optional(),
  targetAudience: z.string().trim().max(500).optional(),
  visualStyle: z.string().trim().max(500).optional(),
  adTone: z.string().trim().max(500).optional(),
  defaultCta: z.string().trim().max(200).optional(),
});

function toRow(b: z.infer<typeof brandSchema>, userId: string) {
  return {
    user_id: userId,
    name: b.name,
    description: b.description || null,
    website: b.website || null,
    logo_url: b.logoUrl || null,
    colors: b.colors,
    industry: b.industry || null,
    target_audience: b.targetAudience || null,
    visual_style: b.visualStyle || null,
    ad_tone: b.adTone || null,
    default_cta: b.defaultCta || null,
  };
}

export async function GET() {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("brand_profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json({ brands: data ?? [] });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = brandSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
    }
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("brand_profiles")
      .insert(toRow(parsed.data, user.id))
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? "Create failed");
    return NextResponse.json({ brand: data }, { status: 201 });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

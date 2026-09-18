import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, toHttpError } from "@/lib/auth";
import { takeToken } from "@/lib/rate-limit";
import { getAssistant } from "@/lib/assistant";
import { createServiceClient } from "@/lib/supabase/server";

const schema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  generationType: z.enum(["image", "video"]),
  brandId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!(await takeToken(`assist:${user.id}`, { limit: 30, windowMs: 60 * 60_000 }))) {
      return NextResponse.json({ error: "Assistant rate limit reached — try again later." }, { status: 429 });
    }
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    let brandContext: string | undefined;
    if (parsed.data.brandId) {
      const db = await createServiceClient();
      const { data: brand } = await db
        .from("brand_profiles")
        .select("name,industry,target_audience,visual_style,ad_tone,default_cta")
        .eq("id", parsed.data.brandId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (brand) {
        const b = brand as Record<string, string | null>;
        brandContext = [b.name, b.industry, b.target_audience, b.visual_style, b.ad_tone, b.default_cta]
          .filter(Boolean)
          .join(" · ");
      }
    }

    const result = await getAssistant().improve({
      prompt: parsed.data.prompt,
      generationType: parsed.data.generationType,
      brandContext,
    });
    return NextResponse.json(result);
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

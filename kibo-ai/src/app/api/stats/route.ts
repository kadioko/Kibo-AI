import { NextResponse } from "next/server";
import { requireUser, toHttpError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    await requireUser();
    const supabase = await createClient();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const countHeads = () =>
      supabase.from("generations").select("id", { count: "exact", head: true });
    const [month, images, videos, spend, active] = await Promise.all([
      countHeads().gte("created_at", monthStart.toISOString()),
      countHeads().eq("generation_type", "image"),
      countHeads().eq("generation_type", "video"),
      supabase.from("usage_logs").select("cost_usd").gte("created_at", monthStart.toISOString()),
      countHeads().in("status", ["queued", "processing"]),
    ]);

    const failures = [month.error, images.error, videos.error, spend.error, active.error].filter(Boolean);
    if (failures.length > 0) throw new Error(failures[0]!.message);
    const totalSpend = ((spend.data ?? []) as Array<{ cost_usd: number }>).reduce(
      (sum, r) => sum + Number(r.cost_usd),
      0,
    );
    return NextResponse.json({
      stats: {
        generationsMonth: month.count ?? 0,
        images: images.count ?? 0,
        videos: videos.count ?? 0,
        spend: Math.round(totalSpend * 100) / 100,
        active: active.count ?? 0,
      },
    });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

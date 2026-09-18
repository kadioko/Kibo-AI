import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { refreshGenerationRecord } from "@/lib/generations/service";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Provider push endpoint — point the Higgsfield console at
 * /api/webhooks/higgsfield if it supports completion callbacks.
 * Authenticated with HIGGSFIELD_WEBHOOK_SECRET (Bearer). Polling remains
 * the primary path; webhooks only accelerate finalization.
 */
export async function POST(request: Request) {
  const secret = process.env.HIGGSFIELD_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhooks are not configured." }, { status: 503 });
  }
  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = (await request.json().catch(() => ({}))) as { request_id?: unknown };
  if (typeof json.request_id !== "string" || !json.request_id) {
    return NextResponse.json({ error: "Missing request_id" }, { status: 400 });
  }

  const db = await createServiceClient();
  const { data: row } = await db
    .from("generations")
    .select("id,user_id")
    .eq("provider_request_id", json.request_id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Unknown request" }, { status: 404 });

  const typed = row as { id: string; user_id: string };
  const generation = await refreshGenerationRecord(typed.user_id, typed.id);
  return NextResponse.json({ status: generation.status });
}

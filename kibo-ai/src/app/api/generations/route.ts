import { NextResponse } from "next/server";
import { requireUser, toHttpError } from "@/lib/auth";
import { checkGenerationLimit } from "@/lib/rate-limit";
import {
  createGenerationRecord,
  favoriteIds,
  serializeGeneration,
  type GenerationRow,
} from "@/lib/generations/service";
import {
  createGenerationSchema,
  listQuerySchema,
} from "@/lib/generations/validation";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const parsed = listQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query", issues: parsed.error.issues }, { status: 400 });
    }
    const q = parsed.data;
    const supabase = await createClient();

    let query = supabase
      .from("generations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(q.limit + 1);

    if (q.type === "image" || q.type === "video") query = query.eq("generation_type", q.type);
    if (q.status !== "all") query = query.eq("status", q.status);
    if (q.model) query = query.eq("model", q.model);
    if (q.projectId) query = query.eq("project_id", q.projectId);
    if (q.search) query = query.ilike("prompt", `%${q.search}%`);
    if (q.cursor) {
      const [createdAt, id] = q.cursor.split("|");
      if (createdAt && id) {
        query = query.or(
          `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`,
        );
      }
    }

    if (q.type === "favorites") {
      const { data: favs } = await supabase
        .from("favorites")
        .select("generation_id")
        .eq("user_id", user.id);
      const ids = (favs ?? []).map((f: { generation_id: string }) => f.generation_id);
      if (ids.length === 0) return NextResponse.json({ generations: [], nextCursor: null });
      query = query.in("id", ids);
    }

    const { data, error } = await query;
    if (error) throw new Error(`DB query failed: ${error.message}`);
    const rows = (data ?? []) as GenerationRow[];

    const hasMore = rows.length > q.limit;
    const page = hasMore ? rows.slice(0, q.limit) : rows;
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? `${last.created_at}|${last.id}` : null;

    const favSet = await favoriteIds(user.id);
    const generations = await Promise.all(page.map((r) => serializeGeneration(r, favSet)));
    return NextResponse.json({ generations, nextCursor });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!(await checkGenerationLimit(user.id))) {
      return NextResponse.json(
        { error: "Rate limit exceeded — please wait a few minutes before generating again." },
        { status: 429 },
      );
    }
    const json = await request.json();
    const parsed = createGenerationSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
    }
    const row = await createGenerationRecord(user.id, parsed.data);
    const favSet = await favoriteIds(user.id);
    return NextResponse.json({ generation: await serializeGeneration(row, favSet) }, { status: 201 });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

import { NextResponse } from "next/server";
import { requireUser, toHttpError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

/** Apply a template — public or your own. */
export async function GET(_request: Request, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("prompt_templates")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json({ template: data });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

/** Delete your own template. Public seeds are not deletable. */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const supabase = await createClient();
    const { error } = await supabase
      .from("prompt_templates")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("is_public", false);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

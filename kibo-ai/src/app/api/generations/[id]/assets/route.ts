import { NextResponse } from "next/server";
import { requireUser, toHttpError } from "@/lib/auth";
import { listAssets } from "@/lib/generations/service";

interface Params {
  params: Promise<{ id: string }>;
}

/** Every stored output file for a generation (batches of N). */
export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    return NextResponse.json({ assets: await listAssets(user.id, id) });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireUser, toHttpError } from "@/lib/auth";
import { INPUTS_BUCKET } from "@/lib/generations/service";
import { createServiceClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
]);
const MAX_BYTES = 100 * 1024 * 1024;

/**
 * Issue a signed upload URL for reference media.
 * Body: { contentType, fileName? }. The client PUTs the file, then sends the
 * public URL form to /api/generations as an input asset.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const json = await request.json().catch(() => ({}));
    const contentType = json?.contentType;
    if (typeof contentType !== "string" || !ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }
    const safeName = String(json?.fileName ?? "upload").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const path = `${user.id}/${randomUUID()}/${safeName}`;
    const db = await createServiceClient();
    const { data, error } = await db.storage
      .from(INPUTS_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) throw new Error(`Upload URL failed: ${error?.message ?? "unknown"}`);

    const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    // kibo-inputs is a PUBLIC bucket (unguessable UUID paths) so the provider
    // can fetch reference media. kibo-outputs stays private + signed URLs.
    const { data: pub } = db.storage.from(INPUTS_BUCKET).getPublicUrl(path);
    return NextResponse.json({
      path,
      signedUrl: data.signedUrl,
      token: data.token,
      /** Send this URL as the input asset for the generation. */
      publicUrl: pub.publicUrl,
      maxBytes: MAX_BYTES,
    });
  } catch (error) {
    const { status, message } = toHttpError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

import { createClient } from "./supabase/server";

export interface AuthedUser {
  id: string;
  email?: string;
}

/** Load the current user or throw a 401-flavoured error. */
export async function requireUser(): Promise<AuthedUser> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    const err = new Error("Unauthorized") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  return { id: user.id, email: user.email ?? undefined };
}

export function toHttpError(error: unknown): { status: number; message: string } {
  if (error instanceof Error && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number") return { status, message: error.message };
  }
  return { status: 500, message: error instanceof Error ? error.message : "Server error" };
}

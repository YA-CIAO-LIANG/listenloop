import { revalidatePath } from "next/cache";
import { getAdminUser } from "./creator";
import { getServerSupabase } from "./server";

/**
 * Shared by the admin-only Server Actions that organize content
 * (collections, notebooks; D24, D25). Writes use the user's own session,
 * so row level security limits them to the user's rows; a write that
 * matches no row means it isn't theirs (or is gone).
 */
export type WriteResult =
  | { ok: true }
  | { ok: false; reason: "unavailable" | "invalid" | "not-found" | "failed" };

type Supabase = NonNullable<Awaited<ReturnType<typeof getServerSupabase>>>;

/** Runs `write` as the signed-in admin, then refreshes `path` on success. */
export async function writeAsAdmin(
  path: string,
  write: (supabase: Supabase, userId: string) => Promise<WriteResult>,
): Promise<WriteResult> {
  const user = await getAdminUser();
  const supabase = user && (await getServerSupabase());
  if (!user || !supabase) return { ok: false, reason: "unavailable" };
  const result = await write(supabase, user.id).catch((): WriteResult => ({
    ok: false,
    reason: "failed",
  }));
  if (result.ok) revalidatePath(path, "layout");
  return result;
}

/** Turns a write's { data, error } into a result; no rows → not found. */
export function writeOutcome({
  data,
  error,
}: {
  data: unknown[] | null;
  error: unknown;
}): WriteResult {
  if (error) return { ok: false, reason: "failed" };
  return data && data.length > 0
    ? { ok: true }
    : { ok: false, reason: "not-found" };
}

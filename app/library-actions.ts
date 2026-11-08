"use server";

import { getServerSupabase } from "@/auth/server";
import { getSignedInUser } from "@/auth/session";
import { LIBRARY_DEFAULT_DOCUMENT } from "@/lib/library-config";
import { parseSavedFilter } from "@/lib/library";

/**
 * Saves (or, with null, clears) the signed-in learner's default library
 * filter (D98) in their account, so every device opens the home page with
 * it. Signed out, the browser keeps it instead.
 */
export async function saveLibraryDefault(
  value: string | null,
): Promise<{ ok: boolean }> {
  const user = await getSignedInUser();
  const supabase = await getServerSupabase();
  if (!user || !supabase) return { ok: false };
  if (value === null) {
    const { error } = await supabase
      .from("user_documents")
      .delete()
      .eq("user_id", user.id)
      .eq("key", LIBRARY_DEFAULT_DOCUMENT);
    return { ok: !error };
  }
  if (!parseSavedFilter(value)) return { ok: false };
  const { error } = await supabase.from("user_documents").upsert({
    user_id: user.id,
    key: LIBRARY_DEFAULT_DOCUMENT,
    data: { filter: value },
  });
  return { ok: !error };
}

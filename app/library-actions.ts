"use server";

import { getServerSupabase } from "@/auth/server";
import { getSignedInUser } from "@/auth/session";
import { CATEGORY_IDS, type CategoryId } from "@/lib/categories";
import { excerptSeconds } from "@/lib/excerpt-length";
import {
  isLibraryLengthId,
  LIBRARY_DEFAULT_DOCUMENT,
  LIBRARY_LENGTHS,
  MAX_CATEGORIES,
} from "@/lib/library-config";
import {
  inCategories,
  inLength,
  parseSavedFilter,
  VIDEO_CATEGORY_IN_LIBRARY,
} from "@/lib/library";
import { customPracticeId } from "@/lib/practice-material";
import { getAllVideos } from "@/lib/video-library";

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

export type LibrarySearchResult =
  { ok: true; ids: string[] } | { ok: false; reason: "invalid" | "failed" };

/**
 * The official library's search on the server (D104): materials in any
 * of the chosen categories (`categories` overlaps them) whose audio runs
 * within the chosen length (`duration_sec` gte / lte). Built-in videos
 * aren't in the database, so they're tested here with the same rules.
 * Returns the ids in the library's links; the page shows those cards.
 */
export async function searchOfficialLibrary(input: {
  categories?: unknown;
  length?: unknown;
}): Promise<LibrarySearchResult> {
  const raw = Array.isArray(input.categories) ? input.categories : [];
  const categories = raw.filter((c): c is CategoryId =>
    (CATEGORY_IDS as readonly unknown[]).includes(c),
  );
  const length = input.length ?? "all";
  if (
    categories.length !== raw.length ||
    categories.length > MAX_CATEGORIES ||
    !isLibraryLengthId(length)
  ) {
    return { ok: false, reason: "invalid" };
  }
  const supabase = await getServerSupabase();
  if (!supabase) return { ok: false, reason: "failed" };
  const range = LIBRARY_LENGTHS.find((l) => l.id === length)!;
  let query = supabase
    .from("practices")
    .select("id")
    .eq("official", true)
    .eq("published", true)
    .eq("visibility", "public")
    .is("removed_at", null);
  if (categories.length > 0) query = query.overlaps("categories", categories);
  if (range.min !== null) query = query.gte("duration_sec", range.min);
  if (range.max !== null) query = query.lte("duration_sec", range.max);
  const { data, error } = await query.limit(500);
  if (error) return { ok: false, reason: "failed" };
  const videos = getAllVideos()
    .filter(
      (video) =>
        inCategories(VIDEO_CATEGORY_IN_LIBRARY[video.category], categories) &&
        inLength(excerptSeconds(video.sentences), length),
    )
    .map((video) => video.id);
  return {
    ok: true,
    ids: [...(data ?? []).map((row) => customPracticeId(row.id)), ...videos],
  };
}

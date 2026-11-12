import { isTextSourceLanguage } from "@/lib/custom-practice/draft";
import {
  PUBLIC_PRACTICES_LIMIT,
  type PublicPracticeSummary,
} from "@/lib/custom-practice/explore";
import { customPracticeId } from "@/lib/practice-material";
import { practiceTitles } from "@/lib/titles";
import { getServerSupabase } from "./server";
import { getSignedInUser } from "./session";

/**
 * The newest practices people shared that are ready (notes made, every
 * sentence voiced), for /explore (D30). Only shared ones: official
 * materials are in the home page's library, never here (D106). Anyone can
 * list and preview them through row level security; practicing them is
 * for paying plans (can_practice). Signed-out visitors can't read author
 * ids, so which ones are the viewer's comes from a second query of their
 * own.
 */
export async function listPublicPractices(): Promise<PublicPracticeSummary[]> {
  return listPractices({ onlyOfficial: false });
}

/**
 * The official practices (D46): made by admins for everyone, listed in
 * the home page's library, oldest first like a course. Same checks as
 * /explore: public, not taken down, notes and audio made.
 */
export async function listOfficialPractices(): Promise<
  PublicPracticeSummary[]
> {
  return listPractices({ onlyOfficial: true });
}

async function listPractices({
  onlyOfficial,
}: {
  onlyOfficial: boolean;
}): Promise<PublicPracticeSummary[]> {
  const [supabase, user] = await Promise.all([
    getServerSupabase(),
    getSignedInUser(),
  ]);
  return listPracticesWith(supabase, user?.id ?? null, onlyOfficial);
}

/**
 * The shared practices as everyone sees them (D133): read with the
 * public key, for signed-out visitors' cached /explore.
 */
export function listPublicPracticesForEveryone(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
): Promise<PublicPracticeSummary[]> {
  return listPracticesWith(supabase, null, false);
}

/**
 * The official practices as everyone sees them (D133): read with the
 * public key, so the library can cache them for every visitor ("mine" is
 * always false; the library doesn't use it).
 */
export function listOfficialPracticesForEveryone(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
): Promise<PublicPracticeSummary[]> {
  return listPracticesWith(supabase, null, true);
}

async function listPracticesWith(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  userId: string | null,
  onlyOfficial: boolean,
): Promise<PublicPracticeSummary[]> {
  if (!supabase) return [];
  const [{ data }, own] = await Promise.all([
    supabase
      .from("practices")
      .select(
        "id, title, title_en, title_zh, subtitle, source_language, voice, created_at, category, scenario, exam, exam_target, level, sort_order, youtube_id, source_audio_path, duration_sec",
      )
      .eq("visibility", "public")
      // Authors can still read their own taken-down practices (D31).
      .is("removed_at", null)
      .not("notes_generated_at", "is", null)
      // Drafts wait in the admin dashboard (D57).
      .eq("published", true)
      // The library lists official ones; /explore only shared ones (D106).
      .eq("official", onlyOfficial)
      // The library in the admins' order (D57), then oldest first.
      .order(onlyOfficial ? "sort_order" : "created_at", {
        ascending: onlyOfficial,
        nullsFirst: false,
      })
      .order("created_at", { ascending: onlyOfficial })
      .limit(PUBLIC_PRACTICES_LIMIT),
    userId
      ? supabase
          .from("practices")
          .select("id")
          .eq("visibility", "public")
          .is("removed_at", null)
          .eq("user_id", userId)
      : null,
  ]);
  const mine = new Set((own?.data ?? []).map((row) => row.id));
  // Counted by the database: free accounts may not read the sentences of
  // shared practices (D106), but every list needs to know they're ready.
  const ids = (data ?? []).map((row) => row.id);
  const { data: counts } = ids.length
    ? await supabase.rpc("public_practice_readiness", { targets: ids })
    : { data: [] };
  const readiness = new Map(
    (counts ?? []).map((c) => [c.practice_id, c] as const),
  );
  return (data ?? []).flatMap((row) => {
    const count = readiness.get(row.id);
    const sentenceCount = count?.sentences ?? 0;
    // A YouTube practice (D97) plays the video: no audio files to wait for.
    const ready =
      sentenceCount > 0 &&
      (row.youtube_id !== null ||
        Boolean(row.source_audio_path) ||
        count?.voiced === sentenceCount);
    if (!ready || !isTextSourceLanguage(row.source_language)) return [];
    return [
      {
        id: customPracticeId(row.id),
        ...((titles) => ({ title: titles.en, titleZh: titles.zh }))(
          practiceTitles(row),
        ),
        sourceLanguage: row.source_language,
        voice: row.voice,
        sentenceCount,
        createdAt: row.created_at,
        mine: mine.has(row.id),
        category: row.category,
        scenario: row.scenario,
        exam: row.exam,
        examTarget: row.exam_target,
        level: row.level,
        subtitle: row.subtitle,
        sortOrder: row.sort_order,
        durationSec: row.duration_sec,
      },
    ];
  });
}

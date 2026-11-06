import { isTextSourceLanguage } from "@/lib/custom-practice/draft";
import {
  PUBLIC_PRACTICES_LIMIT,
  type PublicPracticeSummary,
} from "@/lib/custom-practice/explore";
import { customPracticeId } from "@/lib/practice-material";
import { getServerSupabase } from "./server";
import { getSignedInUser } from "./session";

/**
 * The newest public practices that can be practiced (notes made, every
 * sentence voiced), for /explore (D30). Readable by anyone through row
 * level security; signed-out visitors can't read author ids, so which
 * ones are the viewer's comes from a second query of their own.
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
  if (!supabase) return [];
  const [{ data }, own] = await Promise.all([
    supabase
      .from("practices")
      .select(
        "id, title, source_language, voice, created_at, practice_sentences(audio_path)",
      )
      .eq("visibility", "public")
      // Authors can still read their own taken-down practices (D31).
      .is("removed_at", null)
      .not("notes_generated_at", "is", null)
      // /explore lists every public practice; the library only official ones.
      .in("official", onlyOfficial ? [true] : [true, false])
      .order("created_at", { ascending: onlyOfficial })
      .limit(PUBLIC_PRACTICES_LIMIT),
    user
      ? supabase
          .from("practices")
          .select("id")
          .eq("visibility", "public")
          .is("removed_at", null)
          .eq("user_id", user.id)
      : null,
  ]);
  const mine = new Set((own?.data ?? []).map((row) => row.id));
  return (data ?? []).flatMap((row) => {
    const sentences = row.practice_sentences;
    const ready = sentences.length > 0 && sentences.every((s) => s.audio_path);
    if (!ready || !isTextSourceLanguage(row.source_language)) return [];
    return [
      {
        id: customPracticeId(row.id),
        title: row.title,
        sourceLanguage: row.source_language,
        voice: row.voice,
        sentenceCount: sentences.length,
        createdAt: row.created_at,
        mine: mine.has(row.id),
      },
    ];
  });
}

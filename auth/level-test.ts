import { isLevel } from "@/lib/categories";
import type { LevelTestSource } from "@/lib/level-test";
import { customPracticeId } from "@/lib/practice-material";
import { speechAudioUrl } from "@/lib/supabase/config";
import { getServerSupabase } from "./server";

/** Official materials looked at for the test, at most. */
const SOURCES = 40;

/**
 * The level test's candidates (D109): published official materials with
 * a level, in the library's order, with each sentence's audio. Official
 * materials are open to everyone (can_practice), signed in or not.
 */
export async function levelTestSources(): Promise<LevelTestSource[]> {
  const supabase = await getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("practices")
    .select("id, level, youtube_id, practice_sentences(i, en, zh, audio_path)")
    .eq("official", true)
    .eq("published", true)
    .eq("visibility", "public")
    .is("removed_at", null)
    .not("level", "is", null)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(SOURCES);
  return (data ?? []).flatMap((row) =>
    isLevel(row.level) && !row.youtube_id
      ? [
          {
            id: customPracticeId(row.id),
            level: row.level,
            sentences: [...row.practice_sentences]
              .sort((a, b) => a.i - b.i)
              .map((s) => ({
                en: s.en,
                zh: s.zh,
                audioUrl: s.audio_path ? speechAudioUrl(s.audio_path) : null,
              })),
          },
        ]
      : [],
  );
}

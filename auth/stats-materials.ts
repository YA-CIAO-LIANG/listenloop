import type { MaterialInfo } from "@/lib/analytics";
import { VIDEO_CATEGORY_IN_LIBRARY } from "@/lib/library";
import {
  customPracticeId,
  parseCustomPracticeId,
} from "@/lib/practice-material";
import { getAllVideos } from "@/lib/video-library";
import { getServerSupabase } from "./server";
import { getSignedInUser } from "./session";

/**
 * What the stats page needs about the materials a learner has practiced
 * (D75): titles, category, level, and sentences. Built-in videos come
 * from their files; created practices from the database, for the ids in
 * the account's synced progress (row level security: their own and
 * public ones).
 */
export async function statsMaterials(): Promise<Record<string, MaterialInfo>> {
  const out: Record<string, MaterialInfo> = {};
  for (const video of getAllVideos()) {
    out[video.id] = {
      title: video.title,
      category: VIDEO_CATEGORY_IN_LIBRARY[video.category],
      level: video.level,
      sentences: video.sentences.map((s) => s.en),
    };
  }
  const [user, supabase] = await Promise.all([
    getSignedInUser(),
    getServerSupabase(),
  ]);
  if (!user || !supabase) return out;
  const { data: rows } = await supabase
    .from("progress")
    .select("video_id")
    .eq("user_id", user.id);
  const uuids = (rows ?? []).flatMap(
    (row) => parseCustomPracticeId(row.video_id) ?? [],
  );
  if (uuids.length === 0) return out;
  const { data: practices } = await supabase
    .from("practices")
    .select("id, title, category, level, practice_sentences(i, en)")
    .in("id", uuids);
  for (const practice of practices ?? []) {
    out[customPracticeId(practice.id)] = {
      title: practice.title,
      category: practice.category,
      level: practice.level,
      sentences: [...practice.practice_sentences]
        .sort((a, b) => a.i - b.i)
        .map((s) => s.en),
    };
  }
  return out;
}

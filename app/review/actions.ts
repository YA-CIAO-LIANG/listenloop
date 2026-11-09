"use server";

import { getServerSupabase } from "@/auth/server";
import {
  customPracticeId,
  parseCustomPracticeId,
} from "@/lib/practice-material";
import type { ReviewMaterial } from "@/lib/review";
import { speechAudioUrl } from "@/lib/supabase/config";
import { getVideo } from "@/lib/video-library";

/** Materials asked for at once, at most. */
const MAX_IDS = 100;

/**
 * The sentences of the materials a learner practiced, for filling the
 * misheard-word list from answers kept in progress (D108): built-in
 * videos from their files, created ones with the viewer's own session
 * (row level security decides which they may read, D106).
 */
export async function loadReviewMaterials(
  ids: unknown,
): Promise<Record<string, ReviewMaterial>> {
  if (!Array.isArray(ids)) return {};
  const wanted = [
    ...new Set(ids.filter((id): id is string => typeof id === "string")),
  ].slice(0, MAX_IDS);
  const out: Record<string, ReviewMaterial> = {};
  const uuids: string[] = [];
  for (const id of wanted) {
    const video = getVideo(id);
    if (video) {
      out[id] = {
        sentences: video.sentences.map(({ en, zh }) => ({ en, zh })),
      };
      continue;
    }
    const uuid = parseCustomPracticeId(id);
    if (uuid) uuids.push(uuid);
  }
  const supabase = uuids.length ? await getServerSupabase() : null;
  if (!supabase) return out;
  const { data } = await supabase
    .from("practices")
    .select("id, practice_sentences(i, en, zh, audio_path)")
    .in("id", uuids);
  for (const row of data ?? []) {
    if (row.practice_sentences.length === 0) continue;
    out[customPracticeId(row.id)] = {
      sentences: [...row.practice_sentences]
        .sort((a, b) => a.i - b.i)
        .map((s) => {
          const audio = s.audio_path && speechAudioUrl(s.audio_path);
          return { en: s.en, zh: s.zh, ...(audio ? { audio } : {}) };
        }),
    };
  }
  return out;
}

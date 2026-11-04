import { cache } from "react";
import {
  materialFromCustomPractice,
  parseCustomPracticeId,
  type PracticeMaterial,
} from "@/lib/practice-material";
import { speechAudioUrl } from "@/lib/supabase/config";
import { getVideo } from "@/lib/video-library";
import { getServerSupabase } from "./server";

/**
 * The material behind /videos/<id>: a published video, or one of the
 * signed-in user's created practices (row level security keeps others'
 * out), once its audio is ready. Null answers 404. Cached per request,
 * so the page and its metadata share one database read.
 */
export const getPracticeMaterial = cache(
  async (id: string): Promise<PracticeMaterial | null> => {
    const video = getVideo(id);
    if (video) return video;
    const uuid = parseCustomPracticeId(id);
    if (!uuid) return null;
    const supabase = await getServerSupabase();
    if (!supabase) return null;
    const { data } = await supabase
      .from("practices")
      .select(
        "id, title, vocab, grammar, notes_generated_at, practice_sentences(i, en, zh, audio_path)",
      )
      .eq("id", uuid)
      .maybeSingle();
    return data
      ? materialFromCustomPractice(data, (path) => speechAudioUrl(path))
      : null;
  },
);

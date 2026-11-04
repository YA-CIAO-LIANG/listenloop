import { cache } from "react";
import {
  materialFromCustomPractice,
  parseCustomPracticeId,
  type PracticeMaterial,
} from "@/lib/practice-material";
import { speechAudioUrl } from "@/lib/supabase/config";
import { getVideo } from "@/lib/video-library";
import { getServerSupabase } from "./server";
import { getSignedInUser } from "./session";

/**
 * The material behind /videos/<id>: a published video, or a created
 * practice the viewer may read (their own, or anyone's public one; row
 * level security keeps the rest out, D30), once its notes and audio are
 * ready. Null answers 404. Cached per request, so the page and its
 * metadata share one database read.
 */
export const getPracticeMaterial = cache(
  async (id: string): Promise<PracticeMaterial | null> => {
    const video = getVideo(id);
    if (video) return video;
    const uuid = parseCustomPracticeId(id);
    if (!uuid) return null;
    const [supabase, user] = await Promise.all([
      getServerSupabase(),
      getSignedInUser(),
    ]);
    if (!supabase) return null;
    const [{ data }, own] = await Promise.all([
      supabase
        .from("practices")
        .select(
          "id, title, vocab, grammar, notes_generated_at, practice_sentences(i, en, zh, audio_path)",
        )
        .eq("id", uuid)
        .maybeSingle(),
      // Signed-out visitors can't read author ids, so ask only when signed in.
      user
        ? supabase
            .from("practices")
            .select("id")
            .eq("id", uuid)
            .eq("user_id", user.id)
            .maybeSingle()
        : null,
    ]);
    const material = data
      ? materialFromCustomPractice(data, (path) => speechAudioUrl(path))
      : null;
    return material && { ...material, mine: !!own?.data };
  },
);

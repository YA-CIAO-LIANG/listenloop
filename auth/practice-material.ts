import { cache } from "react";
import {
  customPracticeReadiness,
  materialFromCustomPractice,
  parseCustomPracticeId,
  type CustomPracticeReadiness,
  type PracticeMaterial,
} from "@/lib/practice-material";
import { speechAudioUrl } from "@/lib/supabase/config";
import { getVideo } from "@/lib/video-library";
import { getServerSupabase } from "./server";
import { getSignedInUser } from "./session";

/**
 * What /videos/<id> can show:
 * - ready: a published video, or a created practice the viewer may read
 *   (their own, or anyone's public one; row level security keeps the rest
 *   out, D30) whose notes and audio are made;
 * - preparing: the viewer's own practice whose notes or audio aren't done
 *   yet (made before notes existed, or cut off while generating), so the
 *   page can offer to finish it instead of answering 404 (D32);
 * - null: nothing to show (404), including others' unfinished practices.
 * Cached per request, so a page and its metadata share one database read.
 */
export type PracticeState =
  | { status: "ready"; material: PracticeMaterial }
  | {
      status: "preparing";
      /** The practice's database id (not the "p-" id). */
      practiceId: string;
      title: string;
      readiness: CustomPracticeReadiness;
    };

export const getPracticeState = cache(
  async (id: string): Promise<PracticeState | null> => {
    const video = getVideo(id);
    if (video) return { status: "ready", material: video };
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
    if (!data) return null;
    const mine = !!own?.data;
    const material = materialFromCustomPractice(data, (path) =>
      speechAudioUrl(path),
    );
    if (material) return { status: "ready", material: { ...material, mine } };
    return mine
      ? {
          status: "preparing",
          practiceId: data.id,
          title: data.title,
          readiness: customPracticeReadiness(data),
        }
      : null;
  },
);

/** The practicable material behind /videos/<id>, or null. */
export const getPracticeMaterial = cache(
  async (id: string): Promise<PracticeMaterial | null> => {
    const state = await getPracticeState(id);
    return state?.status === "ready" ? state.material : null;
  },
);

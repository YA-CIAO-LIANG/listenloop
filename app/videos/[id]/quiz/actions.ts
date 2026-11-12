"use server";

import { getAdminSupabase } from "@/auth/admin";
import { supabaseAudioStore } from "@/auth/audio-store";
import { getCreator } from "@/auth/creator";
import { getPracticeMaterial } from "@/auth/practice-material";
import { allowAction } from "@/auth/rate-limit";
import { getSignedInUser } from "@/auth/session";
import { getAiProviders } from "@/lib/ai/providers";
import { reviewable, reviewKey } from "@/lib/review";
import { speechAudioUrl } from "@/lib/supabase/config";
import { quizCandidates } from "@/lib/vocab-quiz";
import { wordAudio, wordVoice } from "@/lib/word-audio";

export type WordAudioUrlResult =
  | { ok: true; url: string }
  | { ok: false; reason: "missing" | "unavailable" | "busy" | "failed" };

/**
 * The pronunciation of one quiz word (D136), or of a misheard word under
 * review (D145): from the shared cache, or
 * made now (Azure F0) for a signed-in learner and kept for everyone. Only
 * the words this material's quiz can ask are made, so this can't be used
 * to voice anything else. Signed out with nothing cached: "missing", and
 * the page uses the browser's own voice.
 */
export async function wordAudioUrl(
  videoId: unknown,
  word: unknown,
): Promise<WordAudioUrlResult> {
  if (typeof videoId !== "string" || typeof word !== "string") {
    return { ok: false, reason: "unavailable" };
  }
  const providers = getAiProviders();
  const admin = getAdminSupabase();
  const material = await getPracticeMaterial(videoId);
  if (!providers || !admin || !material) {
    return { ok: false, reason: "unavailable" };
  }
  // A quiz word, or a misheard word under review (D145): a word that's
  // in this material's sentences, so nothing else can be voiced.
  const key = reviewKey(word);
  const asked =
    quizCandidates(material).find(
      (candidate) => reviewKey(candidate.word) === key,
    ) ??
    (reviewable(key) &&
    material.sentences.some((sentence) =>
      reviewKey(sentence.en)
        .split(/[^\p{L}'-]+/u)
        .includes(key),
    )
      ? { word: key }
      : null);
  if (!asked) return { ok: false, reason: "unavailable" };
  const user = await getSignedInUser();
  const maker =
    user && (await allowAction("ai", user.id)) ? await getCreator() : null;
  const result = await wordAudio(
    { store: supabaseAudioStore(admin), speech: providers.speech, maker },
    wordVoice(material),
    asked.word,
  ).catch(() => ({ ok: false as const, reason: "failed" as const }));
  if (!result.ok) {
    return {
      ok: false,
      reason:
        result.reason === "missing"
          ? "missing"
          : result.reason === "busy" || result.reason === "limit"
            ? "busy"
            : "failed",
    };
  }
  const url = speechAudioUrl(result.path);
  return url ? { ok: true, url } : { ok: false, reason: "unavailable" };
}

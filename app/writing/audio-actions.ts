"use server";

import { getAdminSupabase } from "@/auth/admin";
import { supabaseAudioStore } from "@/auth/audio-store";
import { getCreator } from "@/auth/creator";
import { allowAction } from "@/auth/rate-limit";
import { getSignedInUser } from "@/auth/session";
import { getWritingPrompt } from "@/data/writing";
import { getAiProviders } from "@/lib/ai/providers";
import { speechAudioUrl } from "@/lib/supabase/config";
import { MAX_SENTENCE_CHARS, sentenceAudio } from "@/lib/writing/audio";
import { modelSentences } from "@/lib/writing/back-translation";

export type SentenceAudioUrlResult =
  | { ok: true; url: string }
  | { ok: false; reason: "missing" | "unavailable" | "busy" | "failed" };

/**
 * The recording of one back-translation sentence (D195): an official
 * prompt's model sentence for anyone (from the cache; made now for a
 * signed-in learner if it isn't there yet), or a signed-in learner's own
 * sentence, made the first time and counted against their daily speech
 * characters. Signed out with nothing cached: "missing", and the page
 * uses the browser's own voice.
 */
export async function writingSentenceAudioUrl(
  promptId: unknown,
  text: unknown,
  /** The learner's voice (D220); official sentences are made ahead in the female voice. */
  voice?: unknown,
): Promise<SentenceAudioUrlResult> {
  if (typeof promptId !== "string" || typeof text !== "string") {
    return { ok: false, reason: "unavailable" };
  }
  const sentence = text.trim();
  if (!sentence || sentence.length > MAX_SENTENCE_CHARS) {
    return { ok: false, reason: "unavailable" };
  }
  const providers = getAiProviders();
  const admin = getAdminSupabase();
  if (!providers || !admin) return { ok: false, reason: "unavailable" };
  const prompt = getWritingPrompt(promptId);
  const official =
    prompt !== undefined &&
    modelSentences(prompt).some((s) => s.en === sentence);
  const user = await getSignedInUser();
  // Anything but a model sentence is the learner's own: signed in only.
  if (!official && !user) return { ok: false, reason: "missing" };
  const maker =
    user && (await allowAction("ai", user.id)) ? await getCreator() : null;
  const result = await sentenceAudio(
    { store: supabaseAudioStore(admin), speech: providers.speech, maker },
    sentence,
    voice === "male" ? "male" : "female",
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

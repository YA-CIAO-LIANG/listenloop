import { meteredSpeech, type MeteredDeps } from "../ai/metered";
import type { SpeechProvider, Voice } from "../ai/types";
import { speechCacheKey, type AudioStore } from "../custom-practice/audio";

/**
 * A writing sentence's sound (back-translation, D195): one voice for all
 * of WritingLoop, and the same cache as every practice sentence (the
 * speech bucket, by a hash of the provider, voice, and text), so a
 * sentence is made once and shared. Official model sentences are made
 * ahead (npm run writing:audio); a learner's own sentence is made the
 * first time they practise it, counted against their speech allowance.
 */
export const WRITING_VOICE: Voice = { accent: "us", gender: "female" };

/** Longer than this isn't a sentence to voice. */
export const MAX_SENTENCE_CHARS = 300;

export type SentenceAudioResult =
  | { ok: true; path: string }
  | { ok: false; reason: "missing" | "limit" | "busy" | "failed" | "config" };

export async function sentenceAudio(
  {
    store,
    speech,
    maker,
  }: {
    store: AudioStore;
    speech: Pick<SpeechProvider, "id">;
    /** A signed-in learner's metered providers; null: the cache only. */
    maker: MeteredDeps | null;
  },
  text: string,
): Promise<SentenceAudioResult> {
  const hash = await speechCacheKey(speech.id, WRITING_VOICE, text);
  const found = await store.find(hash);
  if (found) return { ok: true, path: found };
  if (!maker) return { ok: false, reason: "missing" };
  const made = await meteredSpeech(maker, text, WRITING_VOICE);
  if (!made.ok) return { ok: false, reason: made.reason };
  return { ok: true, path: await store.save(hash, made.value) };
}

import { meteredSpeech, type MeteredDeps } from "./ai/metered";
import {
  parseVoiceId,
  VOICE_ACCENTS,
  type SpeechProvider,
  type Voice,
} from "./ai/types";
import { speechCacheKey, type AudioStore } from "./custom-practice/audio";
import { reviewKey } from "./review";

/**
 * A word's pronunciation for the vocabulary quiz (D136): made once per
 * word and voice and shared by everyone, in the same cache as sentence
 * audio. "word\n" in the key keeps it apart from a one-word sentence
 * (which may be said differently).
 */
export const wordCacheText = (word: string) => `word\n${reviewKey(word)}`;

export const wordCacheKey = (
  speech: Pick<SpeechProvider, "id">,
  voice: Voice,
  word: string,
) => speechCacheKey(speech.id, voice, wordCacheText(word));

export type WordAudioResult =
  | { ok: true; path: string }
  /** Not made yet, and this caller may not make it (signed out). */
  | { ok: false; reason: "missing" | "limit" | "busy" | "failed" | "config" };

/**
 * The file for `word` in `voice`: from the cache, or, with `maker` (a
 * signed-in learner's or an admin's metered providers), made now,
 * counted against their daily speech characters, and kept for everyone.
 */
export async function wordAudio(
  {
    store,
    speech,
    maker,
  }: {
    store: AudioStore;
    speech: Pick<SpeechProvider, "id">;
    maker: MeteredDeps | null;
  },
  voice: Voice,
  word: string,
): Promise<WordAudioResult> {
  const hash = await wordCacheKey(speech, voice, word);
  const found = await store.find(hash);
  if (found) return { ok: true, path: found };
  if (!maker) return { ok: false, reason: "missing" };
  const made = await meteredSpeech(maker, word.trim(), voice);
  if (!made.ok) return { ok: false, reason: made.reason };
  return { ok: true, path: await store.save(hash, made.value) };
}

/**
 * The voice a material's words are said in: the practice's own voice,
 * else its accent (built-in videos), else American; always the female
 * voice of that accent when there's no voice.
 */
export function wordVoice(material: {
  voice?: string | null;
  accent?: string;
}): Voice {
  const own = material.voice ? parseVoiceId(material.voice) : null;
  if (own) return own;
  const accent = VOICE_ACCENTS.find((a) => a === material.accent) ?? "us";
  return { accent, gender: "female" };
}

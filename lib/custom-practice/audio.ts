import { meteredSpeech, type MeteredDeps } from "@/lib/ai/metered";
import { voiceId, type SpeechAudio, type Voice } from "@/lib/ai/types";

/**
 * Generating a practice's audio, one file per sentence (D22). Same
 * provider + voice + text → same file, generated once and reused by every
 * practice. Work goes in small batches so each server call stays short
 * and an interrupted run can simply continue.
 */
export const AUDIO_BATCH_SIZE = 8;

/** SHA-256 (hex) of provider, voice, and text: the audio cache key. */
export async function speechCacheKey(
  providerId: string,
  voice: Voice,
  text: string,
): Promise<string> {
  const input = new TextEncoder().encode(
    [providerId, voiceId(voice), text].join("\n"),
  );
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function audioFileName(
  hash: string,
  mimeType: SpeechAudio["mimeType"],
): string {
  return `${hash}.${mimeType === "audio/mpeg" ? "mp3" : "wav"}`;
}

/** Where generated files live; Supabase Storage on the server. */
export interface AudioStore {
  /** The file already made for this key, if any. */
  find(hash: string): Promise<string | null>;
  /** Stores a new file and returns its path. */
  save(hash: string, audio: SpeechAudio): Promise<string>;
}

export type SentenceToVoice = { i: number; en: string };

export type GeneratedBatch = {
  /** Sentences that now have audio, in order. */
  done: { i: number; path: string }[];
  /** Why it stopped early, if it did. */
  stopped?: "limit" | "failed";
};

/**
 * Voices each sentence in turn: reuses a cached file when there is one
 * (no API call, nothing counted), else generates and stores it. Stops at
 * the first sentence that hits the daily limit or fails, keeping the rest.
 */
export async function voiceSentences(
  deps: MeteredDeps & { store: AudioStore },
  voice: Voice,
  sentences: readonly SentenceToVoice[],
): Promise<GeneratedBatch> {
  const done: GeneratedBatch["done"] = [];
  for (const sentence of sentences) {
    try {
      const hash = await speechCacheKey(
        deps.providers.speech.id,
        voice,
        sentence.en,
      );
      let path = await deps.store.find(hash);
      if (!path) {
        const audio = await meteredSpeech(deps, sentence.en, voice);
        if (!audio.ok) return { done, stopped: audio.reason };
        path = await deps.store.save(hash, audio.value);
      }
      done.push({ i: sentence.i, path });
    } catch {
      return { done, stopped: "failed" };
    }
  }
  return { done };
}

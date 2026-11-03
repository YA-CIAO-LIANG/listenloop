/**
 * The provider interfaces for the paid APIs (docs/decisions.md D6, D20).
 * Features call these, never a vendor SDK, so the vendor can change and
 * tests can use the fakes in ./fake.ts without calling any API.
 */

export const VOICE_GENDERS = ["female", "male"] as const;
export type VoiceGender = (typeof VOICE_GENDERS)[number];

/** American, British, Australian, and Indian English. */
export const VOICE_ACCENTS = ["us", "gb", "au", "in"] as const;
export type VoiceAccent = (typeof VOICE_ACCENTS)[number];

export type Voice = { gender: VoiceGender; accent: VoiceAccent };

/** A stable id for a voice, e.g. "us-female"; stored on practices. */
export function voiceId(voice: Voice): string {
  return `${voice.accent}-${voice.gender}`;
}

export function parseVoiceId(id: string): Voice | null {
  const parts = id.split("-");
  if (parts.length !== 2) return null;
  const [accent, gender] = parts;
  if (
    !(VOICE_ACCENTS as readonly string[]).includes(accent) ||
    !(VOICE_GENDERS as readonly string[]).includes(gender)
  ) {
    return null;
  }
  return { accent: accent as VoiceAccent, gender: gender as VoiceGender };
}

/** Languages of practice text: English, and Chinese (handouts: Traditional). */
export type TextLanguage = "en" | "zh-Hant";

export interface TranslationProvider {
  /** Translates each text; the result has the same length and order. */
  translate(
    texts: readonly string[],
    languages: { from: TextLanguage; to: TextLanguage },
  ): Promise<string[]>;
}

export type SpeechAudio = {
  data: Uint8Array;
  mimeType: "audio/mpeg" | "audio/wav";
};

export interface SpeechProvider {
  /**
   * Names the provider and its settings in the audio cache key, so files
   * from another provider (e.g. the fake's silence) are never reused.
   * Change it when the output would change.
   */
  readonly id: string;
  /** Reads `text` aloud in English with `voice`. */
  synthesize(text: string, voice: Voice): Promise<SpeechAudio>;
}

export type AiProviders = {
  translation: TranslationProvider;
  speech: SpeechProvider;
};

import type { VoiceAccent, VoiceGender } from "./types";

/**
 * Google Cloud Text-to-Speech voices for each of our 8 voices (D29): all
 * "Chirp 3: HD", the most natural type, with the same two speakers (Kore,
 * Charon) in every accent. Names are from Google's voice list
 * (docs.cloud.google.com/text-to-speech/docs/list-voices-and-types);
 * change a name here to switch voices, bump GOOGLE_TTS_ID so cached audio
 * isn't reused for the new voice, and remake the samples
 * (npm run voices:samples).
 */
export const GOOGLE_VOICES: Record<
  `${VoiceAccent}-${VoiceGender}`,
  { languageCode: string; name: string }
> = {
  "us-female": {
    languageCode: "en-US",
    name: "en-US-Chirp3-HD-Kore",
  },
  "us-male": {
    languageCode: "en-US",
    name: "en-US-Chirp3-HD-Charon",
  },
  "gb-female": {
    languageCode: "en-GB",
    name: "en-GB-Chirp3-HD-Kore",
  },
  "gb-male": {
    languageCode: "en-GB",
    name: "en-GB-Chirp3-HD-Charon",
  },
  "au-female": {
    languageCode: "en-AU",
    name: "en-AU-Chirp3-HD-Kore",
  },
  "au-male": {
    languageCode: "en-AU",
    name: "en-AU-Chirp3-HD-Charon",
  },
  "in-female": {
    languageCode: "en-IN",
    name: "en-IN-Chirp3-HD-Kore",
  },
  "in-male": {
    languageCode: "en-IN",
    name: "en-IN-Chirp3-HD-Charon",
  },
};

/**
 * The speaker's name shown in the voice menu, e.g. "Kore" for
 * "en-US-Chirp3-HD-Kore" (e+ 3), or null for an unknown voice id.
 */
export function voiceDisplayName(id: string): string | null {
  const voice = GOOGLE_VOICES[id as keyof typeof GOOGLE_VOICES];
  return voice ? (voice.name.split("-").at(-1) ?? null) : null;
}

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
 * Azure Speech neural voices for each of our 8 voices (D39): standard
 * neural voices (HD voices don't cover en-AU or en-IN), one woman and one
 * man per accent. All checked GA on 2026-11-05 with the voices list API
 * in uaenorth. Change a name here to switch voices, bump AZURE_TTS_ID so
 * cached audio isn't reused, and remake the samples (npm run
 * voices:samples).
 */
export const AZURE_VOICES: Record<
  `${VoiceAccent}-${VoiceGender}`,
  { locale: string; name: string }
> = {
  "us-female": { locale: "en-US", name: "en-US-AvaNeural" },
  "us-male": { locale: "en-US", name: "en-US-AndrewNeural" },
  "gb-female": { locale: "en-GB", name: "en-GB-SoniaNeural" },
  "gb-male": { locale: "en-GB", name: "en-GB-RyanNeural" },
  "au-female": { locale: "en-AU", name: "en-AU-NatashaNeural" },
  "au-male": { locale: "en-AU", name: "en-AU-WilliamNeural" },
  "in-female": { locale: "en-IN", name: "en-IN-NeerjaNeural" },
  "in-male": { locale: "en-IN", name: "en-IN-PrabhatNeural" },
};

/**
 * The speaker's name shown in the voice menu, e.g. "Ava" for
 * "en-US-AvaNeural" (e+ 3), or null for an unknown voice id. The names
 * and the samples in public/voices/ are Azure's, the default speech
 * provider (D39).
 */
export function voiceDisplayName(id: string): string | null {
  const voice = AZURE_VOICES[id as keyof typeof AZURE_VOICES];
  return voice
    ? voice.name.slice(voice.locale.length + 1).replace(/Neural$/, "")
    : null;
}

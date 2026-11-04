import type { VoiceAccent, VoiceGender } from "./types";

/**
 * Google Cloud Text-to-Speech voices for each of our 8 voices (D28): all
 * "Standard", the type with the largest monthly free allowance. Names are
 * from Google's voice list (docs.cloud.google.com/text-to-speech/docs/
 * list-voices-and-types); change a name here to switch voices, and bump
 * GOOGLE_TTS_ID so cached audio isn't reused for the new voice.
 */
export const GOOGLE_VOICES: Record<
  `${VoiceAccent}-${VoiceGender}`,
  { languageCode: string; name: string }
> = {
  "us-female": { languageCode: "en-US", name: "en-US-Standard-F" },
  "us-male": { languageCode: "en-US", name: "en-US-Standard-D" },
  "gb-female": { languageCode: "en-GB", name: "en-GB-Standard-A" },
  "gb-male": { languageCode: "en-GB", name: "en-GB-Standard-B" },
  "au-female": { languageCode: "en-AU", name: "en-AU-Standard-A" },
  "au-male": { languageCode: "en-AU", name: "en-AU-Standard-B" },
  "in-female": { languageCode: "en-IN", name: "en-IN-Standard-A" },
  "in-male": { languageCode: "en-IN", name: "en-IN-Standard-B" },
};

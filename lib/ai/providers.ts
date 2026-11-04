import { fakeLanguage, fakeSpeech } from "./fake";
import { geminiLanguage } from "./gemini";
import { googleSpeech } from "./google-tts";
import type { AiProviders } from "./types";

/**
 * Which providers the server uses (D20, D28):
 * - AI_PROVIDERS=fake: the fakes, for local development and preview
 *   testing; never on the production site, even if set there by mistake;
 * - otherwise Gemini (GEMINI_API_KEY) and Cloud Text-to-Speech
 *   (GOOGLE_CLOUD_API_KEY). Creating a practice needs both, so with
 *   either key missing there are none and the feature stays off.
 */
export function getAiProviders(
  env: Record<string, string | undefined> = process.env,
): AiProviders | null {
  if (env.AI_PROVIDERS?.trim() === "fake") {
    return env.VERCEL_ENV === "production"
      ? null
      : { language: fakeLanguage, speech: fakeSpeech };
  }
  const geminiKey = env.GEMINI_API_KEY?.trim();
  const cloudKey = env.GOOGLE_CLOUD_API_KEY?.trim();
  if (!geminiKey || !cloudKey) return null;
  return {
    language: geminiLanguage(geminiKey),
    speech: googleSpeech(cloudKey),
  };
}

import { fakeLanguage, fakeSpeech } from "./fake";
import type { AiProviders } from "./types";

/**
 * Which providers the server uses, from AI_PROVIDERS:
 * - unset: none, so creating practices is unavailable (the default until
 *   Joe approves a paid provider, roadmap "需要 Joe 操作的事" 5);
 * - "fake": the fakes, for local development and preview testing. Never
 *   on the production site, even if set there by mistake.
 */
export function getAiProviders(
  env: Record<string, string | undefined> = process.env,
): AiProviders | null {
  const choice = env.AI_PROVIDERS?.trim();
  if (choice === "fake" && env.VERCEL_ENV !== "production") {
    return { language: fakeLanguage, speech: fakeSpeech };
  }
  return null;
}

import {
  azureEndpoint,
  azureModelPrice,
  azureOpenAiLanguage,
} from "./azure-openai";
import { azureSpeech, isAzureRegion } from "./azure-speech";
import { fakeLanguage, fakeSpeech } from "./fake";
import { geminiLanguage } from "./gemini";
import { googleSpeech } from "./google-tts";
import type { AiProviders, LanguageProvider, SpeechProvider } from "./types";

type Env = Record<string, string | undefined>;

/** Which vendor serves each kind of call (D37). */
export const PROVIDER_CHOICES = ["azure", "google"] as const;
export type ProviderChoice = (typeof PROVIDER_CHOICES)[number];

/** The default for each, when its variable is unset. */
export const DEFAULT_PROVIDERS = {
  language: "azure",
  speech: "azure",
} as const satisfies Record<keyof AiProviders, ProviderChoice>;

const read = (env: Env, name: string) => env[name]?.trim() || undefined;

function choice(
  env: Env,
  name: string,
  fallback: ProviderChoice,
): ProviderChoice | null {
  const value = read(env, name);
  if (!value) return fallback;
  return (PROVIDER_CHOICES as readonly string[]).includes(value)
    ? (value as ProviderChoice)
    : null;
}

function languageProvider(env: Env): LanguageProvider | null {
  const vendor = choice(
    env,
    "AI_LANGUAGE_PROVIDER",
    DEFAULT_PROVIDERS.language,
  );
  if (vendor === "google") {
    const key = read(env, "GEMINI_API_KEY");
    return key ? geminiLanguage(key) : null;
  }
  if (vendor === "azure") {
    const endpoint = read(env, "AZURE_OPENAI_ENDPOINT");
    const apiKey = read(env, "AZURE_OPENAI_API_KEY");
    const deployment = read(env, "AZURE_OPENAI_DEPLOYMENT");
    const model = read(env, "AZURE_OPENAI_MODEL");
    // A model without a known price would go uncounted (D38): off instead.
    return endpoint &&
      apiKey &&
      deployment &&
      model &&
      azureEndpoint(endpoint) &&
      azureModelPrice(model)
      ? azureOpenAiLanguage({ endpoint, apiKey, deployment, model })
      : null;
  }
  return null;
}

function speechProvider(env: Env): SpeechProvider | null {
  const vendor = choice(env, "AI_SPEECH_PROVIDER", DEFAULT_PROVIDERS.speech);
  if (vendor === "google") {
    const key = read(env, "GOOGLE_CLOUD_API_KEY");
    return key ? googleSpeech(key) : null;
  }
  if (vendor === "azure") {
    const key = read(env, "AZURE_SPEECH_KEY");
    const region = read(env, "AZURE_SPEECH_REGION");
    return key && region && isAzureRegion(region)
      ? azureSpeech(key, region)
      : null;
  }
  return null;
}

/**
 * Which providers the server uses (D20, D28, D37):
 * - AI_PROVIDERS=fake: the fakes, for local development and preview
 *   testing; never on the production site, even if set there by mistake;
 * - otherwise AI_LANGUAGE_PROVIDER and AI_SPEECH_PROVIDER each pick
 *   "azure" or "google" (defaults in DEFAULT_PROVIDERS), with that
 *   vendor's keys. Creating a practice needs both kinds, so with either
 *   one unconfigured (or a choice misspelled) there are none and the
 *   feature stays off.
 */
export function getAiProviders(env: Env = process.env): AiProviders | null {
  if (read(env, "AI_PROVIDERS") === "fake") {
    return env.VERCEL_ENV === "production"
      ? null
      : { language: fakeLanguage, speech: fakeSpeech };
  }
  const language = languageProvider(env);
  const speech = speechProvider(env);
  return language && speech ? { language, speech } : null;
}

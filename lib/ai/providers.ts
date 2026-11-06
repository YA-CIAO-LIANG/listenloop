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

/**
 * A variable's value, trimmed, without quotes pasted around it (a common
 * slip in hosting dashboards, D47); undefined when empty.
 */
export function readEnv(env: Env, name: string): string | undefined {
  const value = env[name]
    ?.trim()
    .replace(/^(["'])(.*)\1$/, "$2")
    .trim();
  return value || undefined;
}

/** "UAE North" or "UAENorth" as Azure writes it in URLs: "uaenorth". */
export const normalizeRegion = (value: string) =>
  value.toLowerCase().replace(/\s+/g, "");

/**
 * One condition for creating practices, as /admin/usage lists it (D47):
 * whether it holds, never the value behind it. Ids name translation keys.
 */
export type ConfigCheck = { id: string; ok: boolean };

/** How one kind of provider is set up: the vendor and its checks. */
export type ProviderSetup<P> = {
  /** Null when the choice variable is misspelled. */
  vendor: ProviderChoice | null;
  checks: ConfigCheck[];
  /** The provider, when every check holds. */
  provider: P | null;
};

function setup<P>(
  vendor: ProviderChoice | null,
  checks: ConfigCheck[],
  make: () => P,
): ProviderSetup<P> {
  const ok = vendor !== null && checks.every((check) => check.ok);
  return { vendor, checks, provider: ok ? make() : null };
}

function choice(
  env: Env,
  name: string,
  fallback: ProviderChoice,
): ProviderChoice | null {
  const value = readEnv(env, name)?.toLowerCase();
  if (!value) return fallback;
  return (PROVIDER_CHOICES as readonly string[]).includes(value)
    ? (value as ProviderChoice)
    : null;
}

const isSet = (env: Env, name: string): ConfigCheck => ({
  id: name,
  ok: readEnv(env, name) !== undefined,
});

export function languageSetup(env: Env): ProviderSetup<LanguageProvider> {
  const vendor = choice(
    env,
    "AI_LANGUAGE_PROVIDER",
    DEFAULT_PROVIDERS.language,
  );
  if (vendor === "google") {
    const key = readEnv(env, "GEMINI_API_KEY") ?? "";
    return setup(vendor, [isSet(env, "GEMINI_API_KEY")], () =>
      geminiLanguage(key),
    );
  }
  const endpoint = readEnv(env, "AZURE_OPENAI_ENDPOINT") ?? "";
  const apiKey = readEnv(env, "AZURE_OPENAI_API_KEY") ?? "";
  const deployment = readEnv(env, "AZURE_OPENAI_DEPLOYMENT") ?? "";
  const model = readEnv(env, "AZURE_OPENAI_MODEL")?.toLowerCase() ?? "";
  return setup(
    vendor,
    [
      isSet(env, "AZURE_OPENAI_ENDPOINT"),
      { id: "endpointValid", ok: azureEndpoint(endpoint) !== null },
      isSet(env, "AZURE_OPENAI_API_KEY"),
      isSet(env, "AZURE_OPENAI_DEPLOYMENT"),
      isSet(env, "AZURE_OPENAI_MODEL"),
      // A model without a known price would go uncounted (D38): off instead.
      { id: "modelPriced", ok: azureModelPrice(model) !== null },
    ],
    () => azureOpenAiLanguage({ endpoint, apiKey, deployment, model }),
  );
}

export function speechSetup(env: Env): ProviderSetup<SpeechProvider> {
  const vendor = choice(env, "AI_SPEECH_PROVIDER", DEFAULT_PROVIDERS.speech);
  if (vendor === "google") {
    const key = readEnv(env, "GOOGLE_CLOUD_API_KEY") ?? "";
    return setup(vendor, [isSet(env, "GOOGLE_CLOUD_API_KEY")], () =>
      googleSpeech(key),
    );
  }
  const key = readEnv(env, "AZURE_SPEECH_KEY") ?? "";
  const region = normalizeRegion(readEnv(env, "AZURE_SPEECH_REGION") ?? "");
  return setup(
    vendor,
    [
      isSet(env, "AZURE_SPEECH_KEY"),
      isSet(env, "AZURE_SPEECH_REGION"),
      { id: "regionValid", ok: isAzureRegion(region) },
    ],
    () => azureSpeech(key, region),
  );
}

/** AI_PROVIDERS=fake: the fakes, except on the production site. */
function fakeMode(env: Env): "off" | "on" | "blocked" {
  if (readEnv(env, "AI_PROVIDERS") !== "fake") return "off";
  return env.VERCEL_ENV === "production" ? "blocked" : "on";
}

/**
 * Every condition getAiProviders checks, for the admin's diagnosis on
 * /admin/usage (D47). Holds no values, only whether each check passed.
 */
export function diagnoseAiProviders(env: Env = process.env) {
  return {
    fake: fakeMode(env),
    language: languageSetup(env),
    speech: speechSetup(env),
  };
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
  const fake = fakeMode(env);
  if (fake === "on") return { language: fakeLanguage, speech: fakeSpeech };
  if (fake === "blocked") return null;
  const language = languageSetup(env).provider;
  const speech = speechSetup(env).provider;
  return language && speech ? { language, speech } : null;
}

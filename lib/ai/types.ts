import type { CompositionPrompt } from "@/lib/custom-practice/generation";
import type { TokenPrice } from "./pricing";

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

/**
 * What one provider call used (D38), from the provider's own count where
 * it gives one; logged and charged against the daily cost limit.
 */
export type CallUsage = {
  inputTokens: number;
  /** Output tokens, thinking or reasoning included. */
  outputTokens: number;
  /** Characters sent: the text (speech) or the input (language). */
  chars: number;
  /** Estimated from lib/ai/pricing.ts. */
  costUsd: number;
};

/** A provider's answer and what it cost. */
export type Billed<T> = { value: T; usage: CallUsage };

/**
 * Translation and teaching notes (D27, D28): one language model does
 * all of it. Results are cached by content, so `id` names the provider,
 * model, and prompt version; change it when the output would change.
 */
/**
 * A free check that a provider's key and settings work (D49), for the
 * "Test connection" button on /admin/usage: no text is sent and nothing
 * is billed. `status` and `code` are what the provider answered.
 */
export type ConnectionCheck = { ok: boolean; status?: number; code?: string };

export interface LanguageProvider {
  /** A free connection check (D49); providers without one can't be tested. */
  checkConnection?(): Promise<ConnectionCheck>;
  readonly id: string;
  /** For the worst-case reservation before each call (lib/ai/budgets.ts). */
  readonly price: TokenPrice;
  /** Translates each text; the result has the same length and order. */
  translate(
    texts: readonly string[],
    languages: { from: TextLanguage; to: TextLanguage },
  ): Promise<Billed<string[]>>;
  /**
   * Vocabulary and grammar notes for English `sentences`, shaped like a
   * built-in video's vocab and grammar, with `sentence` indexes into the
   * given list. Unchecked: lib/custom-practice/notes.ts validates it.
   */
  annotate(sentences: readonly string[]): Promise<Billed<unknown>>;
  /**
   * Splits each line of a text into practice sentences by meaning (e+ 4):
   * one list of pieces per line, in order. Unchecked:
   * lib/custom-practice/split.ts makes sure it only cut the text.
   */
  segment(
    lines: readonly string[],
    language: "en" | "zh",
  ): Promise<Billed<unknown>>;
  /**
   * New English practice text (e+ 5): `{ title, lines }`. Unchecked:
   * lib/custom-practice/generation.ts checks it.
   */
  compose(prompt: CompositionPrompt): Promise<Billed<unknown>>;
}

/**
 * A provider call that failed for a reason worth telling apart: "busy"
 * (rate-limited, try again later) or "config" (bad key, API not enabled).
 * `usage` is set when the provider still charged for it (e.g. an answer
 * cut off at the output cap).
 */
/**
 * What the provider answered, for the usage log (D49): the HTTP status and
 * the provider's short error code ("DeploymentNotFound", "timeout"), never
 * a key or the text sent.
 */
export type ProviderErrorDetail = { status?: number; code?: string };

export class ProviderError extends Error {
  constructor(
    readonly code: "busy" | "config" | "failed",
    message: string,
    readonly usage?: CallUsage,
    readonly detail: ProviderErrorDetail = {},
  ) {
    super(message);
    this.name = "ProviderError";
  }
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
  synthesize(text: string, voice: Voice): Promise<Billed<SpeechAudio>>;
  /** A free connection check (D49); providers without one can't be tested. */
  checkConnection?(): Promise<ConnectionCheck>;
}

export type AiProviders = {
  language: LanguageProvider;
  speech: SpeechProvider;
};

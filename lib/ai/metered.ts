import { countChars, type UsageKind, type UsageMeter } from "@/lib/usage";
import {
  ProviderError,
  type AiProviders,
  type SpeechAudio,
  type Voice,
} from "./types";

/**
 * The paid calls, each behind the daily limit: the characters are
 * reserved first and the provider is called only if that succeeds.
 * Reserved characters stay counted even when the call then fails, so a
 * failing provider can't be retried past the limit (D7).
 */
export type MeteredResult<T> =
  { ok: true; value: T } | { ok: false; reason: MeteredFailure };

/** limit: today's allowance is used up; busy: the provider is rate-limited. */
export type MeteredFailure = "limit" | "busy" | "failed";

export type MeteredDeps = { providers: AiProviders; meter: UsageMeter };

/** Reserves first; a meter that can't be reached counts as a failure. */
async function metered<T>(
  meter: UsageMeter,
  kind: UsageKind,
  chars: number,
  call: () => Promise<T>,
): Promise<MeteredResult<T>> {
  try {
    if (!(await meter.reserve(kind, chars))) {
      return { ok: false, reason: "limit" };
    }
    return { ok: true, value: await call() };
  } catch (error) {
    if (!(error instanceof ProviderError)) {
      return { ok: false, reason: "failed" };
    }
    // Admins need to see a configuration problem; learners just retry.
    if (error.code === "config") console.error(`[AI] ${error.message}`);
    return { ok: false, reason: error.code === "busy" ? "busy" : "failed" };
  }
}

/** Any metered language-model call, e.g. notes (lib/custom-practice/notes.ts). */
export function meteredLanguage<T>(
  { meter }: MeteredDeps,
  chars: number,
  call: () => Promise<T>,
): Promise<MeteredResult<T>> {
  return metered(meter, "translation", chars, call);
}

export async function meteredSpeech(
  { providers, meter }: MeteredDeps,
  text: string,
  voice: Voice,
): Promise<MeteredResult<SpeechAudio>> {
  return metered(meter, "speech", countChars([text]), () =>
    providers.speech.synthesize(text, voice),
  );
}

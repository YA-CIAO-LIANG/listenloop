import { countChars, type UsageKind, type UsageMeter } from "@/lib/usage";
import type { AiProviders, SpeechAudio, TextLanguage, Voice } from "./types";

/**
 * The paid calls, each behind the daily limit: the characters are
 * reserved first and the provider is called only if that succeeds.
 * Reserved characters stay counted even when the call then fails, so a
 * failing provider can't be retried past the limit (D7).
 */
export type MeteredResult<T> =
  { ok: true; value: T } | { ok: false; reason: "limit" | "failed" };

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
  } catch {
    return { ok: false, reason: "failed" };
  }
}

export async function meteredTranslate(
  { providers, meter }: MeteredDeps,
  texts: readonly string[],
  languages: { from: TextLanguage; to: TextLanguage },
): Promise<MeteredResult<string[]>> {
  if (texts.length === 0) return { ok: true, value: [] };
  const result = await metered(meter, "translation", countChars(texts), () =>
    providers.translation.translate(texts, languages),
  );
  // A provider that drops or adds lines would misalign the sentences.
  if (result.ok && result.value.length !== texts.length) {
    return { ok: false, reason: "failed" };
  }
  return result;
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

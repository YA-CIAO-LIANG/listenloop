/**
 * Daily limits on the paid APIs (docs/decisions.md D7, D38), per user and
 * per day in Taiwan time. All the numbers live here.
 * - speech: characters. Azure Speech is free up to 500,000 a month and
 *   then stops, so the limit spreads that over the month (~500,000 / 31).
 * - cost: estimated micro-dollars (US$0.000001) of language-model work:
 *   splitting, translation, notes, and generated text (lib/ai/pricing.ts).
 */
export type UsageKind = "speech" | "cost";

export const DAILY_LIMITS: Readonly<Record<UsageKind, number>> = {
  speech: 16_000,
  // US$0.50; with gpt-5-mini a 10,000-character practice is about US$0.03.
  cost: 500_000,
};

/** Days roll over at midnight in this time zone. */
export const USAGE_TIME_ZONE = "Asia/Taipei";

/** The usage day ("2026-11-03") that `now` falls in, in Taiwan time. */
export function usageDay(now: Date): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: USAGE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Characters as the providers bill them: Unicode code points, so a
 * Chinese character or an emoji counts once.
 */
export function countChars(texts: readonly string[]): number {
  let total = 0;
  for (const text of texts) total += [...text].length;
  return total;
}

/** One provider call, for the usage log (/admin/usage). */
export type UsageLogEntry = {
  /** The provider id, e.g. "azure-openai/gpt-5-mini/p1". */
  provider: string;
  /** "speech", or the language operation ("translate", "annotate", …). */
  operation: string;
  /** null when it worked, else why not (MeteredFailure). */
  error: string | null;
  /** A failure's HTTP status from the provider, when it answered (D49). */
  httpStatus: number | null;
  /** A failure's short code: the provider's, or "timeout", "network" (D49). */
  errorCode: string | null;
  inputTokens: number;
  outputTokens: number;
  chars: number;
  /** What was charged against the daily cost limit. */
  costMicros: number;
};

/** Records usage for one user; the server implements it with Supabase. */
export interface UsageMeter {
  /**
   * Adds `amount` to today's `kind` usage if that stays within the daily
   * limit, atomically. False (nothing added) when it would go over.
   */
  reserve(kind: UsageKind, amount: number): Promise<boolean>;
  /**
   * Adds `micros` (negative to give back) to today's cost once a call's
   * real cost is known; never below zero.
   */
  settle(micros: number): Promise<void>;
  log(entry: UsageLogEntry): Promise<void>;
}

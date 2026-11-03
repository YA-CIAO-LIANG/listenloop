/**
 * Daily limits on the paid APIs (docs/decisions.md D7). Speech and
 * translation are counted separately, in characters, per user and per day
 * in Taiwan time. All the numbers live here.
 */
export type UsageKind = "speech" | "translation";

export const DAILY_CHAR_LIMITS: Readonly<Record<UsageKind, number>> = {
  speech: 20_000,
  translation: 20_000,
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

/** Records usage for one user; the server implements it with Supabase. */
export interface UsageMeter {
  /**
   * Adds `chars` to today's `kind` usage if that stays within the daily
   * limit, atomically. False (nothing added) when it would go over.
   */
  reserve(kind: UsageKind, chars: number): Promise<boolean>;
}

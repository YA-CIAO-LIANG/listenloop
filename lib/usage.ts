/**
 * Daily limits on the paid APIs (docs/decisions.md D7, D38), per user and
 * per day in Taiwan time. All the numbers live here.
 * - speech: characters. Azure Speech is free up to 500,000 a month and
 *   then stops, so the limit spreads that over the month (~500,000 / 31).
 * - cost: estimated micro-dollars (US$0.000001) of language-model work:
 *   splitting, translation, notes, and generated text (lib/ai/pricing.ts).
 */
export type UsageKind = "speech" | "cost";

/**
 * Speech characters a day; the cost limit depends on the plan and the
 * kind of work (dailyCostLimit, D77), so `cost` here is the free plan's.
 */
export const DAILY_LIMITS: Readonly<Record<UsageKind, number>> = {
  speech: 16_000,
  cost: 50_000,
};

/**
 * Batch jobs that voice official materials (D59) get more speech a day:
 * a batch reads far more than one learner's practice. Still well inside
 * Azure F0's 500,000 free characters a month.
 */
export const BATCH_SPEECH_CHARS = 120_000;

/**
 * Hand-made work (creating, editing, writing text) or a batch job
 * (upgrading official notes, writing subtitles; D77). Batch jobs have
 * their own daily allowance, so they never use up the manual one.
 */
export type UsageBucket = "manual" | "batch";

/**
 * The AI cost limits (D77, Joe 2026-11-08), in micro-dollars. These are
 * the defaults; admins change them on /admin/usage (usage_settings).
 */
export type UsageSettings = {
  adminManualMicros: number;
  adminBatchMicros: number;
  paidMicros: number;
  freeMicros: number;
  /** Everyone's calls together this month (Taiwan time). */
  siteMonthlyMicros: number;
};

export const DEFAULT_USAGE_SETTINGS: UsageSettings = {
  adminManualMicros: 1_000_000,
  adminBatchMicros: 1_000_000,
  paidMicros: 200_000,
  freeMicros: 50_000,
  siteMonthlyMicros: 8_000_000,
};

/** Admins are warned when the month reaches this share of the cap. */
export const MONTHLY_WARNING_SHARE = 0.8;

/** A day's cost limit for an account on `plan` doing `bucket` work. */
export function dailyCostLimit(
  settings: UsageSettings,
  plan: "free" | "paid" | "pro" | "admin",
  bucket: UsageBucket,
): number {
  if (plan === "admin") {
    return bucket === "batch"
      ? settings.adminBatchMicros
      : settings.adminManualMicros;
  }
  // Pro makes three times Plus's minutes (D102), so three times its daily
  // AI allowance.
  if (plan === "pro") return settings.paidMicros * 3;
  return plan === "paid" ? settings.paidMicros : settings.freeMicros;
}

/** Which allowance stopped a call, and when it comes back (D77). */
export type UsageBlock = {
  kind: "daily" | "batch" | "monthly" | "speech";
  /** ISO time the allowance resets: Taiwan midnight, or the 1st. */
  resetsAt: string;
};

const TAIWAN_OFFSET_MS = 8 * 60 * 60 * 1000;

/** The next midnight in Taiwan after `now`. */
export function nextUsageDay(now: Date): Date {
  const local = new Date(now.getTime() + TAIWAN_OFFSET_MS);
  const midnight = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() + 1,
  );
  return new Date(midnight - TAIWAN_OFFSET_MS);
}

/** The start of this month in Taiwan, and of the next one. */
export function usageMonth(now: Date): { start: Date; next: Date } {
  const local = new Date(now.getTime() + TAIWAN_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  return {
    start: new Date(Date.UTC(y, m, 1) - TAIWAN_OFFSET_MS),
    next: new Date(Date.UTC(y, m + 1, 1) - TAIWAN_OFFSET_MS),
  };
}

/** The most a limit may be set to on /admin/usage: US$100. */
export const MAX_SETTING_MICROS = 100_000_000;

/**
 * Limits typed on /admin/usage, in US$ ("1", "0.05"), as settings; null
 * if any is missing, not a number, negative, or over US$100.
 */
export function parseUsageSettings(input: unknown): UsageSettings | null {
  const raw = (input ?? {}) as Record<string, unknown>;
  const out = {} as UsageSettings;
  for (const key of Object.keys(
    DEFAULT_USAGE_SETTINGS,
  ) as (keyof UsageSettings)[]) {
    const text =
      typeof raw[key] === "string" ? (raw[key] as string).trim() : raw[key];
    const usd = typeof text === "number" ? text : Number(text);
    if (text === "" || !Number.isFinite(usd) || usd < 0) return null;
    const micros = Math.round(usd * 1_000_000);
    if (micros > MAX_SETTING_MICROS) return null;
    out[key] = micros;
  }
  return out;
}

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
  /** The provider's HTTP status, when it answered (D49; successes too, D123). */
  httpStatus: number | null;
  /** A failure's short code: the provider's, or "timeout", "network" (D49). */
  errorCode: string | null;
  /** What a successful call's answer amounted to, e.g. "changed 5/7" (D123). */
  outcome?: string | null;
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
  /** After reserve returned false: which allowance ran out (D77). */
  lastBlock?(): UsageBlock | null;
}

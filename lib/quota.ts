import type { PlanLimits } from "./plans";
import { WORDS_PER_MINUTE } from "./units";

/**
 * Per-account quota changes (D161): an admin gives one account more of a
 * limit for a while (a launch event, a teacher's demo, a bug that ate
 * their minutes), or less (a negative amount, while looking into
 * abuse). The plan's limits plus the changes still in force are what
 * that account gets. An unlimited limit (null) stays unlimited.
 */
export const OVERRIDABLE_LIMITS = [
  "wordsPerWeek",
  "wordsPerMonth",
  "storageMegabytes",
  "revisesPerDay",
] as const;
export type OverridableLimit = (typeof OVERRIDABLE_LIMITS)[number];

export const isOverridableLimit = (value: unknown): value is OverridableLimit =>
  (OVERRIDABLE_LIMITS as readonly unknown[]).includes(value);

export type QuotaOverride = {
  limit: OverridableLimit;
  /** Added to the plan's number; negative to restrict. */
  extra: number;
  /** ISO time it stops counting. */
  expiresAt: string;
};

/** The longest a change can last (days), and the reason's length. */
export const OVERRIDE_MAX_DAYS = 90;
export const OVERRIDE_REASON_MAX = 500;

export function activeOverrides<T extends QuotaOverride>(
  overrides: readonly T[],
  now: Date,
): T[] {
  return overrides.filter((o) => Date.parse(o.expiresAt) > now.getTime());
}

/** The plan's limits with the changes in force at `now`. */
export function withOverrides(
  limits: PlanLimits,
  overrides: readonly QuotaOverride[],
  now: Date,
): PlanLimits {
  const result = { ...limits };
  for (const o of activeOverrides(overrides, now)) {
    const base = result[o.limit];
    if (base === null) continue;
    result[o.limit] = Math.max(0, base + o.extra);
  }
  return result;
}

/**
 * Rows written before quotas were counted in words (D209) name a minute
 * limit; their amount is minutes, converted at WORDS_PER_MINUTE.
 */
const MINUTE_LIMITS: Readonly<Record<string, OverridableLimit>> = {
  minutesPerWeek: "wordsPerWeek",
  minutesPerMonth: "wordsPerMonth",
};

/** A row from quota_overrides, or null if it doesn't look like one. */
export function parseOverride(row: unknown): QuotaOverride | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.extra !== "number" || typeof r.expires_at !== "string") {
    return null;
  }
  const minutes =
    typeof r.limit_name === "string" ? MINUTE_LIMITS[r.limit_name] : undefined;
  if (minutes) {
    return {
      limit: minutes,
      extra: r.extra * WORDS_PER_MINUTE,
      expiresAt: r.expires_at,
    };
  }
  if (!isOverridableLimit(r.limit_name)) return null;
  return { limit: r.limit_name, extra: r.extra, expiresAt: r.expires_at };
}

/** The share of a limit used, for the "almost used up" warning. */
export const QUOTA_WARN_SHARE = 0.8;

export function usageShare(used: number, max: number | null): number | null {
  if (max === null) return null;
  if (max <= 0) return 1;
  return Math.min(1, used / max);
}

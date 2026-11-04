/**
 * Reporting public practices and taking them down (roadmap e2, D31).
 * The reasons are also the database's check constraint values
 * (supabase/migrations/20261104120000_practice_reports.sql).
 */
export const REPORT_REASONS = [
  "copyright",
  "inappropriate",
  "personal",
  "spam",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_LIMITS = {
  /** Characters in the optional details. */
  details: 1000,
  /** Reports one person can send in a day (Taiwan time), against spam. */
  perDay: 20,
} as const;

export function isReportReason(value: unknown): value is ReportReason {
  return (REPORT_REASONS as readonly unknown[]).includes(value);
}

/** Trimmed details, or null if they aren't text or are too long. */
export function cleanReportDetails(value: unknown): string | null {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return null;
  const details = value.trim();
  return [...details].length <= REPORT_LIMITS.details ? details : null;
}

/**
 * The reasons of a practice's open reports, most reported first (ties in
 * REPORT_REASONS order), for the review page and the default takedown
 * reason.
 */
export function tallyReasons(
  reasons: readonly ReportReason[],
): { reason: ReportReason; count: number }[] {
  return REPORT_REASONS.map((reason) => ({
    reason,
    count: reasons.filter((r) => r === reason).length,
  }))
    .filter(({ count }) => count > 0)
    .sort((a, b) => b.count - a.count);
}

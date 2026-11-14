/**
 * One-time notices remembered in cookies (D62), so the server knows
 * whether to show them: they're in the first HTML, and never pop in after
 * the page has drawn (which moved everything below them).
 */
export const USAGE_NOTICE_COOKIE = "ll-usage-notice";
export const ONBOARDING_COOKIE = "ll-onboarding";

/** A year, after which the notice may show once more. */
const MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Where a signed-in person's dismissed notices are kept (user_documents,
 * D180): `{ usage: "<when>" }`, so another device doesn't show them again.
 */
export const NOTICES_DOCUMENT = "notices";

/** Whether a notices document says the usage notice was dismissed. */
export function usageNoticeDismissed(data: unknown): boolean {
  const usage = (data as { usage?: unknown } | null)?.usage;
  return typeof usage === "string" && usage.length > 0;
}

/** Remembers in this browser that a notice was dismissed. */
export function rememberDismissed(name: string): void {
  document.cookie = `${name}=1; path=/; max-age=${MAX_AGE}; samesite=lax`;
}

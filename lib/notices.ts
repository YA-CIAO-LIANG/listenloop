/**
 * One-time notices remembered in cookies (D62), so the server knows
 * whether to show them: they're in the first HTML, and never pop in after
 * the page has drawn (which moved everything below them).
 */
export const USAGE_NOTICE_COOKIE = "ll-usage-notice";
export const ONBOARDING_COOKIE = "ll-onboarding";

/** A year, after which the notice may show once more. */
const MAX_AGE = 60 * 60 * 24 * 365;

/** Remembers in this browser that a notice was dismissed. */
export function rememberDismissed(name: string): void {
  document.cookie = `${name}=1; path=/; max-age=${MAX_AGE}; samesite=lax`;
}

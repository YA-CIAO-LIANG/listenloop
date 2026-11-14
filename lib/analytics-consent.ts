/**
 * Real-user analytics (D148): Microsoft Clarity's anonymous session
 * recordings and heatmaps, only after the visitor agrees to analytics
 * cookies, and only when NEXT_PUBLIC_CLARITY_PROJECT_ID is set. Inputs
 * and personal details are masked; account and admin pages aren't
 * recorded at all.
 */

/** The visitor's choice, on this browser (a cookie, so it's sent too). */
export const CONSENT_COOKIE = "ll-consent";
/** A year, then asked again. */
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 365;

export type Consent = "granted" | "denied";

export const parseConsent = (
  value: string | null | undefined,
): Consent | null => (value === "granted" || value === "denied" ? value : null);

/**
 * Where a signed-in person's choice is kept (user_documents, D180), so
 * every device they sign in on remembers it.
 */
export const CONSENT_DOCUMENT = "consent";

/** The choice in a consent document; anything else is null. */
export function parseConsentDocument(data: unknown): Consent | null {
  const value = (data as { consent?: unknown } | null)?.consent;
  return typeof value === "string" ? parseConsent(value) : null;
}

/**
 * The choice that applies (D180): signed in, the account's when it has
 * one; otherwise this browser's.
 */
export const effectiveConsent = (
  browser: Consent | null,
  account: Consent | null,
): Consent | null => account ?? browser;

/** Clarity's project id, from the environment; null leaves it off. */
export function clarityProjectId(
  env: Record<string, string | undefined> = {
    NEXT_PUBLIC_CLARITY_PROJECT_ID: process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID,
  },
): string | null {
  const id = env.NEXT_PUBLIC_CLARITY_PROJECT_ID?.trim();
  // Clarity's ids are short letters and digits.
  return id && /^[a-z0-9]{6,20}$/i.test(id) ? id : null;
}

/** Pages never recorded: account details, admin pages, class rosters. */
export const UNRECORDED_PATHS = [
  "/account",
  "/admin",
  "/login",
  "/auth",
  // Teachers see their students' names there.
  "/classroom",
];

export function isRecordedPath(pathname: string): boolean {
  return !UNRECORDED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * Practice pages (a day of a material): the notice waits for another page
 * (D180), so it never covers the phone's practice bar mid-exercise.
 * Clarity isn't loaded before a choice anyway.
 */
export const isPracticePath = (pathname: string) =>
  /^\/videos\/[^/]+\/day\/\d+(\/|$)/.test(pathname);

/** Where Clarity loads from and sends to (the CSP allows these, D63). */
export const CLARITY_HOSTS = {
  script: ["https://www.clarity.ms", "https://scripts.clarity.ms"],
  connect: ["https://*.clarity.ms", "https://c.bing.com"],
  img: ["https://*.clarity.ms", "https://c.bing.com"],
} as const;

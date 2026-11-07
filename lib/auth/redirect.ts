/** URL parameter telling the page how a sign-in attempt ended. */
export const SIGN_IN_PARAM = "signin";

export const signInResults = ["failed", "cancelled", "disabled"] as const;
export type SignInResult = (typeof signInResults)[number];

/**
 * Where to go after signing in: a path on this site only. Anything else
 * (another origin, "//evil.example", "/\\evil.example", junk) becomes "/",
 * so the callback can't be used as an open redirect.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || /^\/[/\\]/.test(value)) return "/";
  try {
    const url = new URL(value, "https://listenloop.invalid");
    if (url.origin !== "https://listenloop.invalid") return "/";
    url.searchParams.delete(SIGN_IN_PARAM);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

/** `path` with ?signin=<result> added (for the notice after a failed sign-in). */
export function withSignInResult(path: string, result: SignInResult): string {
  const url = new URL(safeNextPath(path), "https://listenloop.invalid");
  url.searchParams.set(SIGN_IN_PARAM, result);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The sign-in result in a URL value, or null if there is none (or junk). */
export function parseSignInResult(value: string | null): SignInResult | null {
  return signInResults.find((result) => result === value) ?? null;
}

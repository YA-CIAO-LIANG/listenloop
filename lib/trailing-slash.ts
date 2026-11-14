/**
 * Paths with a trailing slash are redirected to the same path without it
 * (D174). Next.js does this by itself, but its redirect has a body with
 * no Content-Type (ZAP 10019), so the proxy does it instead and says the
 * body is plain text (next.config.ts: skipTrailingSlashRedirect).
 *
 * The path to redirect to, or null when there's nothing to change.
 */
export function withoutTrailingSlash(pathname: string): string | null {
  if (pathname === "/" || !pathname.endsWith("/")) return null;
  return pathname.replace(/\/+$/, "") || "/";
}

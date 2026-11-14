/**
 * The public site (D61): its address for absolute links (sitemap, Open
 * Graph, robots), and which paths search engines may list. The public
 * pages themselves are listed in lib/seo.ts (PUBLIC_PAGES, D167).
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  "https://listenloop-three.vercel.app"
).replace(/\/$/, "");

/**
 * Not for crawling (robots.txt): personal, admin, and sign-in-only pages,
 * server endpoints, and a material's practice steps (D167) — the
 * material's own page is the one to find in search. These pages are also
 * noindex, or show nothing without an account.
 */
export const PRIVATE_PATHS = [
  "/admin",
  "/account",
  "/materials",
  "/practices",
  "/stats",
  "/review",
  "/auth",
  "/api",
  "/payments",
  "/checkout",
  "/classroom",
  "/maintenance",
  "/shop",
  "/styleguide",
  "/offline",
  "/invite",
  // Referral links (D177): a redirect that sets a cookie.
  "/r/",
  "/videos/*/day",
  "/videos/*/handout",
  "/videos/*/listen",
  "/videos/*/quiz",
  "/videos/*/timing",
] as const;

/**
 * Search Console and Bing Webmaster Tools ownership tokens (D167, see
 * docs/seo.md): each becomes a <meta> verification tag when set.
 */
export function siteVerification(
  env: Record<string, string | undefined> = process.env,
): { google?: string; other?: Record<string, string> } | undefined {
  const google = env.GOOGLE_SITE_VERIFICATION?.trim();
  const bing = env.BING_SITE_VERIFICATION?.trim();
  if (!google && !bing) return undefined;
  return {
    ...(google ? { google } : {}),
    ...(bing ? { other: { "msvalidate.01": bing } } : {}),
  };
}

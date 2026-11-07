/**
 * The public site (D61): its address for absolute links (sitemap, Open
 * Graph, robots), and which paths search engines may list.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  "https://listenloop-three.vercel.app"
).replace(/\/$/, "");

/** Personal and admin pages: never listed (robots.txt and noindex). */
export const PRIVATE_PATHS = [
  "/admin",
  "/account",
  "/materials",
  "/practices",
  "/stats",
  "/auth",
  "/shop",
  "/styleguide",
  "/offline",
] as const;

/** Public pages for the sitemap, besides each built-in video's. */
export const PUBLIC_PATHS = [
  "/",
  "/explore",
  "/terms",
  "/privacy",
  "/credits",
  "/feedback",
] as const;

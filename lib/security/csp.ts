// Relative: next.config.ts imports this file, without the @/ alias.
import { CLARITY_HOSTS } from "../analytics-consent";

/**
 * The Content Security Policy (P1, D63): what a page may load and run.
 * Scripts need this request's nonce (Next.js adds it to its own; the
 * theme script gets it from the layout) and, with 'strict-dynamic', may
 * load others: the YouTube IFrame API loads its player script that way.
 * The host list after it is only for browsers without 'strict-dynamic'.
 *
 * Checked against production on 2026-11-07: the page itself loads
 * scripts from www.youtube.com; the player runs in a
 * www.youtube-nocookie.com frame (whose own loads aren't ours to allow);
 * Supabase serves sign-in, sync, and practice audio.
 */
export function contentSecurityPolicy({
  nonce,
  supabaseUrl,
  development = false,
  clarity = false,
}: {
  nonce: string;
  supabaseUrl: string | null;
  development?: boolean;
  /** Microsoft Clarity is set up (D148): its hosts are allowed. */
  clarity?: boolean;
}): string {
  const analytics = (hosts: readonly string[]) => (clarity ? hosts : []);
  const supabase = supabaseUrl ? new URL(supabaseUrl).origin : null;
  const supabaseSocket = supabase?.replace(/^http/, "ws") ?? null;
  const directives: Record<string, (string | null)[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      "https://www.youtube.com",
      "https://s.ytimg.com",
      ...analytics(CLARITY_HOSTS.script),
      // React's dev tools evaluate code; never in production.
      development ? "'unsafe-eval'" : null,
    ],
    // Inline style attributes (custom properties for animations).
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      "https://i.ytimg.com",
      supabase,
      ...analytics(CLARITY_HOSTS.img),
    ],
    "font-src": ["'self'", "data:"],
    "media-src": ["'self'", "blob:", supabase],
    "connect-src": [
      "'self'",
      supabase,
      supabaseSocket,
      ...analytics(CLARITY_HOSTS.connect),
    ],
    "frame-src": [
      "https://www.youtube-nocookie.com",
      "https://www.youtube.com",
    ],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const policy = Object.entries(directives)
    .map(([name, values]) =>
      [name, ...values.filter((v): v is string => v !== null)].join(" "),
    )
    .join("; ");
  // Upgrading http to https would break a local http Supabase (E2E).
  const local = development || supabase?.startsWith("http:");
  return local ? policy : `${policy}; upgrade-insecure-requests`;
}

/** A fresh nonce per request: 128 random bits, base64. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Headers every response gets (D63): HTTPS only, no MIME sniffing, no
 * framing, a careful referrer, and only the microphone (for shadowing)
 * among powerful features.
 */
export const SECURITY_HEADERS: readonly { key: string; value: string }[] = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

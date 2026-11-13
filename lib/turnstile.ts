/**
 * Cloudflare Turnstile (D160), the free bot check, on the forms bots
 * target: email sign-up, the Beta waiting list, reports, and feedback.
 * Off until both keys are set: NEXT_PUBLIC_TURNSTILE_SITE_KEY (public,
 * in the page) and TURNSTILE_SECRET_KEY (server only).
 */
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";
export const TURNSTILE_SCRIPT = `${TURNSTILE_ORIGIN}/turnstile/v0/api.js?render=explicit`;
export const TURNSTILE_VERIFY = `${TURNSTILE_ORIGIN}/turnstile/v0/siteverify`;

/** The form field the token travels in. */
export const TURNSTILE_FIELD = "turnstile";

/** The public site key, or null when Turnstile isn't set up. */
export function turnstileSiteKey(
  // Read literally, so Next.js puts it in the browser bundle.
  raw: string | undefined = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
): string | null {
  const key = raw?.trim();
  return key ? key : null;
}

/**
 * Recent sign-in for an admin's risky actions (D159): deleting or taking
 * down, changing plans or seats, the emergency switches, the cost
 * limits, refunds, and exports need a sign-in within the last 30
 * minutes, so a session left open (or stolen) can't do the most damage.
 */
export const RECENT_SIGN_IN_SECONDS = 30 * 60;

/**
 * When the session was signed in (seconds since 1970), from the token's
 * `amr` (Supabase lists each way the user proved who they are, with its
 * time); refreshing the token doesn't change it. null when unknown.
 */
export function signedInAt(claims: unknown): number | null {
  if (!claims || typeof claims !== "object") return null;
  const amr = (claims as { amr?: unknown }).amr;
  if (!Array.isArray(amr)) return null;
  const times = amr
    .map((entry) =>
      entry && typeof entry === "object"
        ? Number((entry as { timestamp?: unknown }).timestamp)
        : NaN,
    )
    .filter((t) => Number.isFinite(t) && t > 0);
  return times.length ? Math.max(...times) : null;
}

export function signedInRecently(
  at: number | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!at) return false;
  const age = now.getTime() / 1000 - at;
  return age >= -60 && age <= RECENT_SIGN_IN_SECONDS;
}

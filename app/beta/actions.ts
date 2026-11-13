"use server";

import { verifyTurnstile } from "@/auth/turnstile";
import { getAdminSupabase } from "@/auth/admin";
import { allowAction } from "@/auth/rate-limit";
import { cleanWaitlistEntry } from "@/lib/beta";

export type BetaWaitlistResult =
  | { ok: true }
  | {
      ok: false;
      reason: "invalid" | "busy" | "unavailable" | "failed" | "bot";
    };

/**
 * Joins the Beta waiting list (D132): an email and what they'd like to
 * use ListenLoop for. No account needed. Joining twice keeps one entry
 * (the newer purpose), and the answer is the same either way.
 */
export async function joinBetaWaitlist(
  input: unknown,
): Promise<BetaWaitlistResult> {
  const raw = (input ?? {}) as Record<string, unknown>;
  const entry = cleanWaitlistEntry({ email: raw.email, purpose: raw.purpose });
  if (!entry) return { ok: false, reason: "invalid" };
  // Cloudflare Turnstile (D160): off until its keys are set.
  if (!(await verifyTurnstile(raw.turnstile)))
    return { ok: false, reason: "bot" };
  if (!(await allowAction("betaWaitlist", null))) {
    return { ok: false, reason: "busy" };
  }
  const admin = getAdminSupabase();
  if (!admin) return { ok: false, reason: "unavailable" };
  const { error } = await admin
    .from("beta_waitlist")
    .upsert(entry, { onConflict: "email" });
  return error ? { ok: false, reason: "failed" } : { ok: true };
}

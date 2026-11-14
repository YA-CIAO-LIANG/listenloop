"use server";

import { cookies } from "next/headers";
import { getAdminSupabase } from "@/auth/admin";
import { allowAction } from "@/auth/rate-limit";
import { getPriceView } from "@/auth/prices";
import { getSignedInUser } from "@/auth/session";
import { parseIntent, VISITOR_COOKIE } from "@/lib/intent";

/** A year: long enough to count a returning visitor once. */
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Records one step toward paying (D93, P2): never charges, never fails
 * the page. Signed out, a random visitor id in a cookie stands in for the
 * account; it isn't linked to anything else.
 */
export async function recordIntent(input: unknown): Promise<{ ok: boolean }> {
  const intent = parseIntent(input);
  const admin = getAdminSupabase();
  if (!intent || !admin) return { ok: false };
  const user = await getSignedInUser();
  if (!(await allowAction("intent", user?.id ?? null))) return { ok: false };

  const jar = await cookies();
  let visitor = jar.get(VISITOR_COOKIE)?.value;
  if (!visitor || !/^[a-f0-9-]{8,64}$/.test(visitor)) {
    visitor = crypto.randomUUID();
    jar.set(VISITOR_COOKIE, visitor, {
      path: "/",
      maxAge: VISITOR_MAX_AGE,
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
  }
  // The price experiment this person is in, worked out again here from
  // who they are (never taken from the browser, D174).
  const { experiment } = await getPriceView(
    user ? `u:${user.id}` : `v:${visitor}`,
  );
  const { error } = await admin.from("intent_events").insert({
    user_id: user?.id ?? null,
    visitor_id: visitor,
    step: intent.step,
    plan: intent.plan ?? null,
    billing_interval: intent.interval ?? null,
    item: intent.item ?? null,
    source: intent.source ?? null,
    experiment_id: experiment?.id ?? null,
    variant: experiment?.variant ?? null,
  });
  if (error) console.error(`[intent] not recorded: ${error.message}`);
  return { ok: !error };
}

"use server";

import { logEvent } from "@/auth/events";
import { getSignedInUser } from "@/auth/session";
import { cleanClientEvent } from "@/lib/events";

/**
 * Events the browser reports (D55): practice started, a day completed,
 * a retry, a skipped sentence, a speech recognition failure. Only for
 * signed-in learners: signed-out practice stays on the device, unlogged.
 */
export async function recordEvent(raw: unknown): Promise<void> {
  const event = cleanClientEvent(raw);
  if (!event) return;
  const user = await getSignedInUser();
  if (!user) return;
  await logEvent(user.id, event);
}

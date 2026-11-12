"use server";

import { getAdminSupabase } from "@/auth/admin";
import { getSignedInUser } from "@/auth/session";
import { isTimeZone } from "@/lib/time-zone";

/**
 * Keeps the signed-in learner's time zone (D139) in their profile and on
 * their reminder subscriptions, when their device's changes (travel,
 * a new device). Signed out, the cookie alone is enough.
 */
export async function saveTimeZone(
  timeZone: unknown,
): Promise<{ ok: boolean }> {
  if (!isTimeZone(timeZone)) return { ok: false };
  const user = await getSignedInUser();
  const admin = getAdminSupabase();
  if (!user || !admin) return { ok: false };
  const [profile, reminders] = await Promise.all([
    admin
      .from("profiles")
      .update({ time_zone: timeZone })
      .eq("user_id", user.id),
    admin
      .from("reminders")
      .update({ time_zone: timeZone })
      .eq("user_id", user.id),
  ]);
  return { ok: !profile.error && !reminders.error };
}

"use server";

import { getServerSupabase } from "@/auth/server";
import { getSignedInUser } from "@/auth/session";
import {
  isReminderTime,
  isTimeZone,
  REMINDER_LOCALES,
  type ReminderLocale,
} from "@/lib/reminders";

export type ReminderResult = { ok: true } | { ok: false };

type Subscription = { endpoint: string; p256dh: string; auth: string };

/** A push subscription from the browser, checked; or null. */
function parseSubscription(value: unknown): Subscription | null {
  if (typeof value !== "object" || value === null) return null;
  const { endpoint, keys } = value as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  if (
    typeof endpoint !== "string" ||
    !/^https:\/\//.test(endpoint) ||
    endpoint.length > 1000 ||
    typeof keys?.p256dh !== "string" ||
    keys.p256dh.length > 200 ||
    typeof keys.auth !== "string" ||
    keys.auth.length > 100
  ) {
    return null;
  }
  return { endpoint, p256dh: keys.p256dh, auth: keys.auth };
}

/**
 * Turns reminders on for this browser, or changes their time (D111):
 * saved with the learner's own session (row level security: their rows).
 */
export async function saveReminder(input: {
  subscription: unknown;
  time: unknown;
  timeZone: unknown;
  locale: unknown;
}): Promise<ReminderResult> {
  const subscription = parseSubscription(input.subscription);
  if (
    !subscription ||
    !isReminderTime(input.time) ||
    !isTimeZone(input.timeZone)
  ) {
    return { ok: false };
  }
  const locale: ReminderLocale = (
    REMINDER_LOCALES as readonly unknown[]
  ).includes(input.locale)
    ? (input.locale as ReminderLocale)
    : "zh-Hant";
  const [user, supabase] = await Promise.all([
    getSignedInUser(),
    getServerSupabase(),
  ]);
  if (!user || !supabase) return { ok: false };
  const { error } = await supabase.from("reminders").upsert({
    ...subscription,
    user_id: user.id,
    remind_at: input.time,
    time_zone: input.timeZone,
    locale,
    updated_at: new Date().toISOString(),
  });
  return error ? { ok: false } : { ok: true };
}

/** Turns reminders off for this browser. */
export async function deleteReminder(
  endpoint: unknown,
): Promise<ReminderResult> {
  if (typeof endpoint !== "string") return { ok: false };
  const [user, supabase] = await Promise.all([
    getSignedInUser(),
    getServerSupabase(),
  ]);
  if (!user || !supabase) return { ok: false };
  const { error } = await supabase
    .from("reminders")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);
  return error ? { ok: false } : { ok: true };
}

/** This browser's reminder time, if it has one. */
export async function reminderTime(endpoint: unknown): Promise<string | null> {
  if (typeof endpoint !== "string") return null;
  const [user, supabase] = await Promise.all([
    getSignedInUser(),
    getServerSupabase(),
  ]);
  if (!user || !supabase) return null;
  const { data } = await supabase
    .from("reminders")
    .select("remind_at")
    .eq("endpoint", endpoint)
    .eq("user_id", user.id)
    .maybeSingle();
  return data?.remind_at ?? null;
}

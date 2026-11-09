/**
 * Sends practice reminders (D111): run every 15 minutes by
 * .github/workflows/reminders.yml (off until REMINDERS_SCHEDULE=on). For
 * each subscription whose time has come today (in its own time zone) and
 * hasn't been sent today, it sends a push notification — unless the
 * learner has already practiced today — and notes the day. Subscriptions
 * the push service says are gone (404, 410) are deleted. No paid API:
 * web push is free.
 *
 *   node --env-file=.env.local scripts/send-reminders.mts
 */
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { dueReminderDay, reminderMessage } from "../lib/reminders.ts";

const env = (name: string) => process.env[name]?.trim() ?? "";
const url = env("NEXT_PUBLIC_SUPABASE_URL");
const key = env("SUPABASE_SERVICE_ROLE_KEY");
const publicKey = env("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
const privateKey = env("VAPID_PRIVATE_KEY");
const subject = env("VAPID_SUBJECT") || "https://listenloop-three.vercel.app";
if (!url || !key || !publicKey || !privateKey) {
  console.log("Reminders aren't set up (Supabase or VAPID keys missing).");
  process.exit(0);
}
webpush.setVapidDetails(subject, publicKey, privateKey);
const admin = createClient(url, key, { auth: { persistSession: false } });

const now = new Date();
const { data: rows, error } = await admin
  .from("reminders")
  .select(
    "endpoint, user_id, p256dh, auth, remind_at, time_zone, locale, last_sent_on",
  );
if (error) {
  console.error(`Couldn't read reminders: ${error.message}`);
  process.exit(1);
}

let sent = 0;
let skipped = 0;
let gone = 0;
for (const row of rows ?? []) {
  const day = dueReminderDay(row, now);
  if (!day) continue;
  // Already practiced today (an official task in the activity log): no need.
  const { data: activity } = await admin
    .from("user_documents")
    .select("data")
    .eq("user_id", row.user_id)
    .eq("key", "activity")
    .maybeSingle();
  const days = (
    activity?.data as { days?: Record<string, { official?: boolean }> }
  )?.days;
  if (days?.[day]?.official) {
    skipped += 1;
  } else {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        JSON.stringify(reminderMessage(row.locale)),
        { TTL: 60 * 60 },
      );
      sent += 1;
    } catch (failure) {
      const status = (failure as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await admin.from("reminders").delete().eq("endpoint", row.endpoint);
        gone += 1;
        continue;
      }
      console.error(`Push failed (HTTP ${status ?? "?"})`);
      continue;
    }
  }
  await admin
    .from("reminders")
    .update({ last_sent_on: day })
    .eq("endpoint", row.endpoint);
}
console.log(
  `Reminders: ${sent} sent, ${skipped} already practiced, ${gone} expired, ${rows?.length ?? 0} subscriptions.`,
);

/**
 * Practice reminders (D111): a push notification once a day at the time
 * the learner chose, in their time zone, unless they've already practiced
 * that day. Pure logic, shared by the settings and the reminder job
 * (scripts/send-reminders.mts, run every 15 minutes by GitHub Actions).
 * No imports, so the job can run it with plain Node.
 */
export const DEFAULT_REMINDER_TIME = "20:00";

/** A reminder is sent at its time or up to this long after (job delays). */
export const REMINDER_WINDOW_MINUTES = 60;

export const REMINDER_LOCALES = ["zh-Hant", "en"] as const;
export type ReminderLocale = (typeof REMINDER_LOCALES)[number];

/** "HH:MM", 24-hour. */
export const isReminderTime = (value: unknown): value is string =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

/** Whether the browser's time zone name is one this runtime knows. */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** The date ("YYYY-MM-DD") and minutes since midnight in `timeZone`. */
export function localClock(
  now: Date,
  timeZone: string,
): { date: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

const toMinutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export type ReminderRow = {
  remind_at: string;
  time_zone: string;
  last_sent_on: string | null;
};

/**
 * Whether a reminder should go out now: its time has come today (within
 * REMINDER_WINDOW_MINUTES) and it hasn't been sent today. Returns that
 * local day, to note as sent, or null.
 */
export function dueReminderDay(
  reminder: ReminderRow,
  now: Date,
  window = REMINDER_WINDOW_MINUTES,
): string | null {
  if (!isReminderTime(reminder.remind_at) || !isTimeZone(reminder.time_zone)) {
    return null;
  }
  const { date, minutes } = localClock(now, reminder.time_zone);
  const at = toMinutes(reminder.remind_at);
  if (minutes < at || minutes >= at + window) return null;
  return reminder.last_sent_on === date ? null : date;
}

/** The notification, in the learner's interface language. */
export function reminderMessage(locale: string): {
  title: string;
  body: string;
  url: string;
} {
  return locale === "en"
    ? {
        title: "Time for today's listening",
        body: "A few minutes keeps your 7-day loop going.",
        url: "/",
      }
    : {
        title: "今天的聽力練習時間到了",
        body: "花幾分鐘，讓你的 7 天循環繼續前進。",
        url: "/",
      };
}

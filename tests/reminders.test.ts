import { describe, expect, it, vi } from "vitest";
import {
  dueReminderDay,
  isReminderTime,
  isTimeZone,
  localClock,
  REMINDER_WINDOW_MINUTES,
  reminderMessage,
} from "@/lib/reminders";

vi.mock("@/auth/session", () => ({
  getSignedInUser: async () => ({ id: "u1" }),
}));
const upsert = vi.fn(async () => ({ error: null }));
vi.mock("@/auth/server", () => ({
  getServerSupabase: async () => ({ from: () => ({ upsert }) }),
}));
const { saveReminder } = await import("@/app/account/reminder-actions");

/** Practice reminders (D111). */
const taipei = { time_zone: "Asia/Taipei", last_sent_on: null };
// 2026-11-11 20:10 in Taipei (UTC+8).
const at2010 = new Date("2026-11-11T12:10:00Z");

describe("when a reminder is due", () => {
  it("is due from its time, in its own time zone, for an hour", () => {
    expect(dueReminderDay({ ...taipei, remind_at: "20:00" }, at2010)).toBe(
      "2026-11-11",
    );
    expect(
      dueReminderDay({ ...taipei, remind_at: "20:30" }, at2010),
    ).toBeNull();
    expect(
      dueReminderDay(
        { ...taipei, remind_at: "19:00" },
        new Date(at2010.getTime() + 0),
      ),
    ).toBeNull(); // 70 minutes late: past the window
    expect(REMINDER_WINDOW_MINUTES).toBe(60);
  });

  it("goes once a day", () => {
    expect(
      dueReminderDay(
        { ...taipei, remind_at: "20:00", last_sent_on: "2026-11-11" },
        at2010,
      ),
    ).toBeNull();
    expect(
      dueReminderDay(
        { ...taipei, remind_at: "20:00", last_sent_on: "2026-11-10" },
        at2010,
      ),
    ).toBe("2026-11-11");
  });

  it("uses the learner's own date across midnight UTC", () => {
    // 07:30 in Taipei is 23:30 the day before in UTC.
    const morning = new Date("2026-11-10T23:30:00Z");
    expect(localClock(morning, "Asia/Taipei")).toEqual({
      date: "2026-11-11",
      minutes: 7 * 60 + 30,
    });
    expect(dueReminderDay({ ...taipei, remind_at: "07:15" }, morning)).toBe(
      "2026-11-11",
    );
    expect(
      dueReminderDay(
        {
          remind_at: "15:30",
          time_zone: "America/New_York",
          last_sent_on: null,
        },
        new Date("2026-11-11T20:40:00Z"),
      ),
    ).toBe("2026-11-11");
  });

  it("ignores broken rows", () => {
    expect(
      dueReminderDay({ ...taipei, remind_at: "25:00" }, at2010),
    ).toBeNull();
    expect(
      dueReminderDay(
        { remind_at: "20:00", time_zone: "Mars/Base", last_sent_on: null },
        at2010,
      ),
    ).toBeNull();
  });
});

describe("checking input", () => {
  it("accepts 24-hour times and real time zones", () => {
    expect(isReminderTime("07:05")).toBe(true);
    expect(isReminderTime("7:05")).toBe(false);
    expect(isTimeZone("Asia/Taipei")).toBe(true);
    expect(isTimeZone("Nowhere/Land")).toBe(false);
  });

  it("speaks the learner's language", () => {
    expect(reminderMessage("en").title).toMatch(/listening/);
    expect(reminderMessage("zh-Hant").title).toMatch(/聽力/);
  });

  it("saves only a real push subscription", async () => {
    const good = {
      subscription: {
        endpoint: "https://push.example.com/abc",
        keys: { p256dh: "key", auth: "secret" },
      },
      time: "20:00",
      timeZone: "Asia/Taipei",
      locale: "en",
    };
    expect(await saveReminder(good)).toEqual({ ok: true });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "https://push.example.com/abc",
        user_id: "u1",
        remind_at: "20:00",
        locale: "en",
      }),
    );
    upsert.mockClear();
    for (const bad of [
      { ...good, subscription: { endpoint: "http://insecure", keys: {} } },
      { ...good, time: "8pm" },
      { ...good, timeZone: "Nowhere/Land" },
    ]) {
      expect(await saveReminder(bad)).toEqual({ ok: false });
    }
    expect(upsert).not.toHaveBeenCalled();
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { parseActivity, type Activity } from "@/lib/activity";
import {
  addPracticeTime,
  daySeconds,
  IDLE_LIMIT_MS,
  isPracticing,
  MAX_TICK_SECONDS,
  mergeDayTime,
  practiceMinutes,
  REVIEW_TIME_KEY,
  secondsByMaterial,
  TIMER_START,
  timerFlush,
  timerTick,
  type TimerFlush,
  type TimerState,
} from "@/lib/practice-time";
import { toLocalDate } from "@/lib/dates";
import { mergeActivity } from "@/lib/sync/merge";

/** Practice time (D74). */
const empty: Activity = { days: {} };

describe("addPracticeTime", () => {
  it("adds to this device's count for the material", () => {
    let log = addPracticeTime(empty, "2026-11-08", "phone", "sintel", 30);
    log = addPracticeTime(log, "2026-11-08", "phone", "sintel", 30);
    log = addPracticeTime(log, "2026-11-08", "phone", "p-1", 15);
    expect(log.days["2026-11-08"]?.time).toEqual({
      phone: { sintel: 60, "p-1": 15 },
    });
    expect(log.days["2026-11-08"]?.official).toBe(false);
  });

  it("ignores nothing or less", () => {
    expect(addPracticeTime(empty, "2026-11-08", "phone", "x", 0)).toBe(empty);
  });
});

describe("merging two devices", () => {
  it("keeps each device's larger count, and adds devices up", () => {
    const merged = mergeDayTime(
      { phone: { sintel: 60 }, laptop: { sintel: 10 } },
      { phone: { sintel: 90, "p-1": 5 } },
    );
    expect(merged).toEqual({
      phone: { sintel: 90, "p-1": 5 },
      laptop: { sintel: 10 },
    });
    expect(daySeconds({ official: false, retries: [], time: merged })).toBe(
      105,
    );
  });

  it("is part of syncing the activity log", () => {
    const a = addPracticeTime(empty, "2026-11-08", "phone", "sintel", 60);
    const b = addPracticeTime(empty, "2026-11-08", "laptop", "sintel", 40);
    const merged = mergeActivity(a, b);
    expect(secondsByMaterial(merged.days["2026-11-08"])).toEqual({
      sintel: 100,
    });
    // Merging again changes nothing: never counted twice.
    expect(mergeActivity(merged, a)).toEqual(merged);
  });

  it("survives a save and load", () => {
    const log = addPracticeTime(empty, "2026-11-08", "phone", "sintel", 60);
    expect(parseActivity(JSON.parse(JSON.stringify(log)))).toEqual(log);
    expect(
      parseActivity({
        days: {
          "2026-11-08": {
            official: false,
            retries: [],
            time: { phone: { sintel: -1 } },
          },
        },
      }),
    ).toBeNull();
  });
});

describe("isPracticing", () => {
  const now = 1_000_000;
  const base = { visible: true, focused: true, playing: false, now };

  it("counts while active in the last two minutes", () => {
    expect(isPracticing({ ...base, lastActive: now - 1000 })).toBe(true);
    expect(isPracticing({ ...base, lastActive: now - IDLE_LIMIT_MS })).toBe(
      false,
    );
  });

  it("stops when the page is hidden or the window loses focus", () => {
    expect(
      isPracticing({ ...base, visible: false, lastActive: now, playing: true }),
    ).toBe(false);
    expect(isPracticing({ ...base, focused: false, lastActive: now })).toBe(
      false,
    );
  });

  it("counts while audio plays, even without input", () => {
    expect(
      isPracticing({
        ...base,
        focused: false,
        playing: true,
        lastActive: now - 10 * IDLE_LIMIT_MS,
      }),
    ).toBe(true);
  });
});

describe("the practice timer's seconds (D181)", () => {
  const tick = (
    state: TimerState,
    date: string,
    counting = true,
  ): ReturnType<typeof timerTick> => timerTick(state, { counting, date });

  it("counts only counted seconds, saving every 30", () => {
    let state = TIMER_START;
    const saved: TimerFlush[] = [];
    for (let i = 0; i < 40; i++) {
      // Every fourth second is paused (hidden, idle, or nothing to do).
      const r = tick(state, "2026-11-14", i % 4 !== 3);
      state = r.state;
      if (r.flush) saved.push(r.flush);
    }
    expect(saved).toEqual([{ date: "2026-11-14", seconds: 30 }]);
    expect(state.pending).toBe(0);
    expect(timerFlush(state).flush).toBeNull();
  });

  it("puts seconds before midnight on the day before, after on the next", () => {
    let state = TIMER_START;
    const saved: TimerFlush[] = [];
    for (const date of [
      ...Array<string>(10).fill("2026-11-14"),
      ...Array<string>(5).fill("2026-11-15"),
    ]) {
      const r = tick(state, date);
      state = r.state;
      if (r.flush) saved.push(r.flush);
    }
    const last = timerFlush(state);
    if (last.flush) saved.push(last.flush);
    expect(saved).toEqual([
      { date: "2026-11-14", seconds: 10 },
      { date: "2026-11-15", seconds: 5 },
    ]);
  });

  it("saves what's pending when the page is hidden or left", () => {
    let state = TIMER_START;
    for (let i = 0; i < 7; i++) state = tick(state, "2026-11-14").state;
    const { state: after, flush } = timerFlush(state);
    expect(flush).toEqual({ date: "2026-11-14", seconds: 7 });
    expect(after.pending).toBe(0);
  });

  it("pauses in the background, except listening mode's audio (D183)", () => {
    const now = 5_000_000;
    const at = { now, lastActive: now, focused: true };
    expect(isPracticing({ ...at, visible: false, playing: true })).toBe(false);
    expect(isPracticing({ ...at, visible: false, playing: false })).toBe(false);
    // Listening mode: playing on the lock screen counts; paused doesn't.
    const listen = { ...at, visible: false, background: true };
    expect(isPracticing({ ...listen, playing: true })).toBe(true);
    expect(isPracticing({ ...listen, playing: false })).toBe(false);
    expect(
      isPracticing({
        ...listen,
        playing: true,
        lastActive: now - 60 * 60_000,
      }),
    ).toBe(true);
    // Idle over two minutes: paused, unless audio is playing in front.
    const idle = { ...at, lastActive: now - IDLE_LIMIT_MS, visible: true };
    expect(isPracticing({ ...idle, playing: false })).toBe(false);
    expect(isPracticing({ ...idle, playing: true })).toBe(true);
  });
});

describe("slow ticks in the background (D183)", () => {
  it("counts the seconds since the last tick, up to a minute", () => {
    const date = "2026-11-14";
    let r = timerTick(TIMER_START, { counting: true, date, seconds: 1 });
    expect(r.state.pending).toBe(1);
    // A tick a minute later (a background page's timers): 60 seconds.
    r = timerTick(TIMER_START, { counting: true, date, seconds: 60.2 });
    expect(r.flush).toEqual({ date, seconds: 60 });
    // A frozen page coming back after ten minutes: only a minute.
    r = timerTick(TIMER_START, { counting: true, date, seconds: 600 });
    expect(r.flush).toEqual({ date, seconds: MAX_TICK_SECONDS });
    // Not counting: nothing, however long.
    r = timerTick(TIMER_START, { counting: false, date, seconds: 60 });
    expect(r.state).toBe(TIMER_START);
  });

  it("puts a slow tick after midnight on the new day", () => {
    let r = timerTick(TIMER_START, {
      counting: true,
      date: "2026-11-14",
      seconds: 10,
    });
    r = timerTick(r.state, { counting: true, date: "2026-11-15", seconds: 20 });
    expect(r.flush).toEqual({ date: "2026-11-14", seconds: 10 });
    expect(r.state).toMatchObject({ date: "2026-11-15", pending: 20 });
  });
});

describe("the local date a second belongs to (D181)", () => {
  const original = process.env.TZ;
  afterEach(() => {
    process.env.TZ = original;
  });

  it("follows the device's time zone", () => {
    // 2026-11-14 16:30 UTC: past midnight in Taipei, afternoon in Chicago.
    const instant = new Date("2026-11-14T16:30:00Z");
    process.env.TZ = "Asia/Taipei";
    expect(toLocalDate(instant)).toBe("2026-11-15");
    process.env.TZ = "America/Chicago";
    expect(toLocalDate(instant)).toBe("2026-11-14");
  });
});

describe("practiceMinutes", () => {
  it("rounds a day's seconds, every device added", () => {
    const log = addPracticeTime(
      addPracticeTime(empty, "2026-11-14", "phone", "sintel", 600),
      "2026-11-14",
      "laptop",
      REVIEW_TIME_KEY,
      89,
    );
    expect(practiceMinutes(log.days["2026-11-14"])).toBe(11);
    expect(practiceMinutes(undefined)).toBe(0);
  });
});

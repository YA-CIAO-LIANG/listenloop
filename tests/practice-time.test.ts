import { describe, expect, it } from "vitest";
import { parseActivity, type Activity } from "@/lib/activity";
import {
  addPracticeTime,
  daySeconds,
  IDLE_LIMIT_MS,
  isPracticing,
  mergeDayTime,
  secondsByMaterial,
} from "@/lib/practice-time";
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

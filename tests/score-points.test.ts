import { describe, expect, it } from "vitest";
import { parseActivity, recordTask, type Activity } from "@/lib/activity";
import { parseIntent } from "@/lib/intent";
import { createProgress, withDay } from "@/lib/progress";
import {
  perfectSentences,
  SCORE_RULES,
  scoreEntries,
  totalScore,
} from "@/lib/score-points";
import { mergeActivity } from "@/lib/sync/merge";

const task = (day: number, perfect?: number) => ({
  videoId: "sintel",
  week: 1,
  day,
  ...(perfect === undefined ? {} : { perfect }),
});

describe("score (D93)", () => {
  it("counts days, perfect sentences, and streaks from the 2nd day", () => {
    let activity: Activity = { days: {} };
    activity = recordTask(activity, "2026-11-01", task(1, 3));
    activity = recordTask(activity, "2026-11-02", task(2));
    activity = recordTask(activity, "2026-11-03", task(3, 0));
    activity = recordTask(activity, "2026-11-05", task(4, 1));
    const entries = scoreEntries(activity, []);
    expect(entries.map((e) => [e.date, e.kind, e.amount])).toEqual([
      ["2026-11-01", "day", SCORE_RULES.day],
      ["2026-11-01", "perfect", 3 * SCORE_RULES.perfectSentence],
      ["2026-11-02", "day", 10],
      ["2026-11-02", "streak", SCORE_RULES.streakBonus],
      ["2026-11-03", "day", 10],
      ["2026-11-03", "streak", 5],
      // A gap starts the streak over.
      ["2026-11-05", "day", 10],
      ["2026-11-05", "perfect", 2],
    ]);
    expect(totalScore(entries)).toBe(10 + 6 + 15 + 15 + 12);
  });

  it("counts days only in progress too (logs from before tasks were kept)", () => {
    const progress = withDay(createProgress("sintel", "2026-11-01"), 1, {
      done: true,
      date: "2026-11-01",
      score: 1,
    });
    expect(totalScore(scoreEntries({ days: {} }, [progress]))).toBe(10);
  });

  it("finds 100% sentences in dictation answers and shadowing coverage", () => {
    const sentences = [{ en: "Go home." }, { en: "We moved." }];
    expect(
      perfectSentences(
        { done: true, answers: ["go home", "we move"] },
        sentences,
      ),
    ).toBe(1);
    expect(
      perfectSentences(
        {
          done: true,
          sentences: [
            { done: true, coverage: 1 },
            { done: true, coverage: null },
          ],
        },
        sentences,
      ),
    ).toBe(1);
    expect(perfectSentences(undefined, sentences)).toBe(0);
  });

  it("keeps the perfect count through validation and sync", () => {
    const withCount: Activity = {
      days: {
        "2026-11-01": { official: true, retries: [], tasks: [task(1, 2)] },
      },
    };
    const without: Activity = {
      days: { "2026-11-01": { official: true, retries: [], tasks: [task(1)] } },
    };
    expect(parseActivity(withCount)).not.toBeNull();
    expect(
      parseActivity({
        days: {
          "2026-11-01": { official: true, retries: [], tasks: [task(1, -1)] },
        },
      }),
    ).toBeNull();
    for (const merged of [
      mergeActivity(withCount, without),
      mergeActivity(without, withCount),
    ]) {
      expect(merged.days["2026-11-01"]?.tasks).toEqual([task(1, 2)]);
    }
  });
});

describe("parseIntent (D93)", () => {
  it("accepts known steps and sources, with short ids", () => {
    expect(
      parseIntent({
        step: "unlock_click",
        item: "accent-teal",
        source: "color-unlock",
      }),
    ).toEqual({
      step: "unlock_click",
      item: "accent-teal",
      source: "color-unlock",
    });
  });

  it("refuses anything else", () => {
    expect(parseIntent({ step: "buy" })).toBeNull();
    expect(parseIntent({ step: "pricing_view", source: "evil" })).toBeNull();
    expect(parseIntent({ step: "pricing_view", item: "<script>" })).toBeNull();
    expect(parseIntent("pricing_view")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { parseActivity, recordTask } from "@/lib/activity";
import { addDays } from "@/lib/dates";
import { addPracticeTime } from "@/lib/practice-time";
import { createProgress, type Progress } from "@/lib/progress";
import {
  addMisses,
  blankOut,
  dueReviews,
  isLearned,
  isRightAnswer,
  mergeReview,
  missesFromProgress,
  parseReview,
  recordReview,
  REVIEW_INTERVALS,
  REVIEW_PER_DAY,
  reviewable,
  sentenceMisses,
  type ReviewState,
} from "@/lib/review";
import { mergeActivity } from "@/lib/sync/merge";

/** "My misheard words" (D108): spaced review at 1, 3, and 7 days. */
const source = {
  en: "The station is on the left.",
  zh: "車站在左邊。",
  videoId: "p-1",
  i: 0,
  audio: "https://example.com/a.mp3",
};
const now = new Date("2026-11-11T10:00:00+08:00");

describe("what gets reviewed", () => {
  it("skips short and very common words", () => {
    expect(reviewable("station")).toBe(true);
    expect(reviewable("is")).toBe(false);
    expect(reviewable("The")).toBe(false);
    expect(reviewable("left")).toBe(true);
  });

  it("finds the misheard words of an answer, with where they were", () => {
    const misses = sentenceMisses(source, "the nation is on the lift");
    expect(misses.map((m) => m.word)).toEqual(["station", "left"]);
    expect(misses[0]).toMatchObject({
      videoId: "p-1",
      i: 0,
      zh: "車站在左邊。",
    });
  });
});

describe("the schedule", () => {
  const start = addMisses(
    {},
    sentenceMisses(source, "the nation is on the left"),
    "2026-11-10",
    now,
  );

  it("brings a word back the day after it was misheard", () => {
    expect(start.station).toMatchObject({ stage: 0, due: "2026-11-11" });
    expect(dueReviews(start, "2026-11-10")).toEqual([]);
    expect(dueReviews(start, "2026-11-11").map(([key]) => key)).toEqual([
      "station",
    ]);
  });

  it("then 3 days later, then 7, then it's learned", () => {
    let state = recordReview(start, "station", true, "2026-11-11", now);
    expect(state.station).toMatchObject({ stage: 1, due: "2026-11-14" });
    state = recordReview(state, "station", true, "2026-11-14", now);
    expect(state.station).toMatchObject({ stage: 2, due: "2026-11-21" });
    state = recordReview(state, "station", true, "2026-11-21", now);
    expect(state.station.stage).toBe(REVIEW_INTERVALS.length);
    expect(isLearned(state.station)).toBe(true);
    expect(dueReviews(state, "2027-01-01")).toEqual([]);
  });

  it("a wrong answer starts it over, due tomorrow", () => {
    let state = recordReview(start, "station", true, "2026-11-11", now);
    state = recordReview(state, "station", false, "2026-11-14", now);
    expect(state.station).toMatchObject({ stage: 0, due: "2026-11-15" });
  });

  it("missing it again in dictation starts it over too", () => {
    const learned: ReviewState = {
      station: { ...start.station, stage: 3 },
    };
    const again = addMisses(
      learned,
      sentenceMisses(source, "the nation is on the left"),
      "2026-12-01",
      now,
    );
    expect(again.station).toMatchObject({ stage: 0, due: "2026-12-02" });
  });

  it("leaves known words alone when filling from older answers", () => {
    const reviewed = recordReview(start, "station", true, "2026-11-11", now);
    const filled = addMisses(
      reviewed,
      sentenceMisses(source, "the nation is on the lift"),
      "2026-11-01",
      now,
      { onlyNew: true },
    );
    expect(filled.station).toEqual(reviewed.station);
    expect(filled.left).toMatchObject({ stage: 0, due: "2026-11-02" });
  });

  it("shows at most a day's worth, oldest first", () => {
    let state: ReviewState = {};
    for (let n = 0; n < REVIEW_PER_DAY + 5; n++) {
      state = addMisses(
        state,
        [{ ...source, word: `word${String(n).padStart(2, "0")}` }],
        addDays("2026-11-01", n),
        now,
      );
    }
    const due = dueReviews(state, "2026-12-31");
    expect(due).toHaveLength(REVIEW_PER_DAY);
    expect(due[0][0]).toBe("word00");
  });
});

describe("answers and blanks", () => {
  it("compares like dictation: case, punctuation, numbers", () => {
    expect(isRightAnswer("Station.", "station")).toBe(true);
    expect(isRightAnswer("five", "5")).toBe(true);
    expect(isRightAnswer("stations", "station")).toBe(false);
    expect(isRightAnswer("  ", "station")).toBe(false);
  });

  it("blanks the whole word, keeping the sentence's own spelling", () => {
    expect(blankOut("There is the station.", "the")).toEqual({
      before: "There is ",
      word: "the",
      after: " station.",
    });
    expect(blankOut("Don’t go there.", "don't")).toMatchObject({
      word: "Don’t",
      after: " go there.",
    });
    expect(blankOut("No match here.", "station")).toBeNull();
  });
});

describe("filling the list from progress", () => {
  it("uses finished Day 1 and Day 7 answers, with their dates", () => {
    const progress: Progress = {
      ...createProgress("p-1", "2026-11-01"),
      days: {
        1: {
          done: true,
          score: 0.5,
          date: "2026-11-01",
          answers: ["the nation is on the left"],
        },
      },
    };
    const found = missesFromProgress([progress], {
      "p-1": { sentences: [{ en: source.en, zh: source.zh }] },
    });
    expect(found).toEqual([
      {
        date: "2026-11-01",
        misses: [expect.objectContaining({ word: "station", i: 0 })],
      },
    ]);
    // A material it can't read (a shared one on the free plan) is skipped.
    expect(missesFromProgress([progress], {})).toEqual([]);
  });
});

describe("keeping and syncing the list", () => {
  const state = addMisses(
    {},
    sentenceMisses(source, "the nation is on the left"),
    "2026-11-10",
    now,
  );

  it("merges devices by the latest change of each word", () => {
    const later = recordReview(
      state,
      "station",
      true,
      "2026-11-11",
      new Date("2026-11-11T12:00:00+08:00"),
    );
    expect(mergeReview(state, later).station.stage).toBe(1);
    expect(mergeReview(later, state).station.stage).toBe(1);
  });

  it("travels in the activity log, kept by other updates", () => {
    const activity = { days: {}, review: state };
    expect(parseActivity(JSON.parse(JSON.stringify(activity)))).toEqual(
      activity,
    );
    expect(
      recordTask(activity, "2026-11-11", { videoId: "p-1", week: 1, day: 2 })
        .review,
    ).toBe(state);
    expect(addPracticeTime(activity, "2026-11-11", "d", "p-1", 30).review).toBe(
      state,
    );
    expect(mergeActivity({ days: {} }, activity).review).toEqual(state);
  });

  it("drops malformed entries", () => {
    expect(
      parseReview({ station: state.station, broken: { en: 1 }, x: null }),
    ).toEqual({ station: state.station });
    expect(parseReview("nope")).toBeUndefined();
  });
});

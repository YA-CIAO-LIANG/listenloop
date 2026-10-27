import { describe, expect, it } from "vitest";
import { nextUnanswered, startDictation, submitAnswer } from "@/lib/dictation";
import { createProgress } from "@/lib/progress";
import type { Sentence } from "@/lib/videos";

const today = "2026-10-27";
const sentences: Sentence[] = [
  { i: 0, start: 0, end: 1, en: "Go home.", zh: "回家。" },
  { i: 1, start: 1, end: 2, en: "We moved to the city.", zh: "我們搬到城市。" },
];

describe("startDictation", () => {
  it("creates progress with an empty answer per sentence", () => {
    const progress = startDictation(null, "sintel", 1, 2, today);
    expect(progress.videoId).toBe("sintel");
    expect(progress.days[1]).toEqual({ done: false, answers: [null, null] });
  });

  it("keeps existing answers when resuming", () => {
    const started = startDictation(null, "sintel", 1, 2, today);
    const answered = submitAnswer(started, 1, 0, "go home", sentences, today);
    expect(startDictation(answered, "sintel", 1, 2, today)).toBe(answered);
  });

  it("keeps other days untouched", () => {
    const base = createProgress("sintel", "2026-10-20");
    base.days[1] = { done: true, date: "2026-10-20", score: 0.5 };
    const progress = startDictation(base, "sintel", 7, 2, today);
    expect(progress.days[1]).toEqual(base.days[1]);
    expect(progress.days[7]).toEqual({ done: false, answers: [null, null] });
  });
});

describe("nextUnanswered", () => {
  it("finds the first unanswered sentence", () => {
    expect(nextUnanswered([null, null])).toBe(0);
    expect(nextUnanswered(["a", null])).toBe(1);
    expect(nextUnanswered(["a", "b"])).toBe(-1);
  });

  it("treats an empty string as an answer", () => {
    expect(nextUnanswered(["", null])).toBe(1);
  });
});

describe("submitAnswer", () => {
  const started = startDictation(null, "sintel", 1, 2, today);

  it("records an answer without finishing the day", () => {
    const progress = submitAnswer(started, 1, 0, "go home", sentences, today);
    expect(progress.days[1]).toEqual({
      done: false,
      answers: ["go home", null],
    });
  });

  it("only counts the first submission for a sentence", () => {
    const first = submitAnswer(started, 1, 0, "go hom", sentences, today);
    const second = submitAnswer(first, 1, 0, "go home", sentences, today);
    expect(second).toBe(first);
    expect(second.days[1]?.answers?.[0]).toBe("go hom");
  });

  it("finishes the day with a word-weighted score after the last answer", () => {
    let progress = submitAnswer(started, 1, 0, "go home", sentences, today); // 2/2
    progress = submitAnswer(
      progress,
      1,
      1,
      "we move to the city", // 4/5
      sentences,
      today,
    );
    expect(progress.days[1]).toEqual({
      done: true,
      date: today,
      score: 6 / 7,
      answers: ["go home", "we move to the city"],
    });
  });

  it("can be answered out of order", () => {
    let progress = submitAnswer(started, 1, 1, "x", sentences, today);
    expect(progress.days[1]?.done).toBe(false);
    progress = submitAnswer(progress, 1, 0, "go home", sentences, today);
    expect(progress.days[1]?.done).toBe(true);
  });

  it("ignores submissions once the day is done or not started", () => {
    let done = submitAnswer(started, 1, 0, "go home", sentences, today);
    done = submitAnswer(done, 1, 1, "we moved to the city", sentences, today);
    expect(submitAnswer(done, 1, 0, "again", sentences, today)).toBe(done);

    const notStarted = createProgress("sintel", today);
    expect(submitAnswer(notStarted, 1, 0, "x", sentences, today)).toBe(
      notStarted,
    );
  });
});

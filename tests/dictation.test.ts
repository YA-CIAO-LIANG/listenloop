import { describe, expect, it } from "vitest";
import {
  attemptScore,
  emptyAnswers,
  nextUnanswered,
  recordAnswer,
  startDictation,
  submitAnswer,
  type Answers,
} from "@/lib/dictation";
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

describe("attempt helpers (shared by official runs and retries)", () => {
  it("creates an empty attempt", () => {
    expect(emptyAnswers(3)).toEqual([null, null, null]);
  });

  it("records only the first answer per sentence", () => {
    const first = recordAnswer(emptyAnswers(2), 0, "go hom");
    expect(first).toEqual(["go hom", null]);
    expect(recordAnswer(first, 0, "go home")).toBe(first);
  });

  it("scores a finished attempt by word count", () => {
    expect(attemptScore(sentences, ["go home", "we move to the city"])).toBe(
      6 / 7,
    );
    expect(attemptScore(sentences, ["", ""])).toBe(0);
  });

  it("can never change an official result", () => {
    let official = startDictation(null, "sintel", 1, 2, today);
    official = submitAnswer(official, 1, 0, "x", sentences, today);
    official = submitAnswer(official, 1, 1, "y", sentences, today);
    const snapshot = structuredClone(official);

    // A full retry works on its own answers list…
    let retry: Answers = emptyAnswers(2);
    retry = recordAnswer(retry, 0, "go home");
    retry = recordAnswer(retry, 1, "we moved to the city");
    expect(attemptScore(sentences, retry)).toBe(1);

    // …and the official run refuses any further submissions.
    expect(submitAnswer(official, 1, 0, "go home", sentences, today)).toBe(
      official,
    );
    expect(official).toEqual(snapshot);
    expect(official.days[1]?.score).toBe(0);
  });
});

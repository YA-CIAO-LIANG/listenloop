import { describe, expect, it } from "vitest";
import { createProgress } from "@/lib/progress";
import {
  averageCoverage,
  emptySentenceRecords,
  isShadowingDay,
  nextUnfinished,
  recordAttempt,
  startShadowing,
  submitShadowing,
  type SentenceRecords,
} from "@/lib/shadowing";

const today = "2026-10-28";

describe("isShadowingDay", () => {
  it("is true for Days 2–6 only", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(isShadowingDay)).toEqual([
      false,
      true,
      true,
      true,
      true,
      true,
      false,
    ]);
  });
});

describe("recordAttempt", () => {
  const empty = emptySentenceRecords(2);

  it("marks a sentence done at 70% coverage or more", () => {
    expect(recordAttempt(empty, 0, { coverage: 0.7 })[0]).toEqual({
      done: true,
      coverage: 0.7,
    });
  });

  it("keeps a sentence open below 70%, remembering the coverage", () => {
    expect(recordAttempt(empty, 0, { coverage: 0.69 })[0]).toEqual({
      done: false,
      coverage: 0.69,
    });
  });

  it("keeps the best coverage and never undoes a done sentence", () => {
    let records = recordAttempt(empty, 0, { coverage: 0.9 });
    records = recordAttempt(records, 0, { coverage: 0.4 });
    expect(records[0]).toEqual({ done: true, coverage: 0.9 });
  });

  it("can be retried until it passes", () => {
    let records = recordAttempt(empty, 1, { coverage: 0.3 });
    records = recordAttempt(records, 1, { coverage: 0.5 });
    expect(records[1].done).toBe(false);
    records = recordAttempt(records, 1, { coverage: 0.8 });
    expect(records[1]).toEqual({ done: true, coverage: 0.8 });
  });

  it("marks a sentence done by hand without inventing a coverage", () => {
    expect(recordAttempt(empty, 0, { manual: true })[0]).toEqual({
      done: true,
      coverage: null,
    });
  });

  it("returns the same list when nothing changes", () => {
    const done = recordAttempt(empty, 0, { coverage: 1 });
    expect(recordAttempt(done, 0, { coverage: 0.5 })).toBe(done);
    expect(recordAttempt(done, 0, { manual: true })).toBe(done);
    expect(recordAttempt(empty, 9, { coverage: 1 })).toBe(empty);
  });
});

describe("nextUnfinished and averageCoverage", () => {
  it("finds the next sentence to read", () => {
    let records: SentenceRecords = emptySentenceRecords(3);
    expect(nextUnfinished(records)).toBe(0);
    records = recordAttempt(records, 0, { coverage: 1 });
    expect(nextUnfinished(records)).toBe(1);
  });

  it("averages recognized coverage and ignores manual sentences", () => {
    let records: SentenceRecords = emptySentenceRecords(3);
    records = recordAttempt(records, 0, { coverage: 0.8 });
    records = recordAttempt(records, 1, { coverage: 1 });
    records = recordAttempt(records, 2, { manual: true });
    expect(averageCoverage(records)).toBeCloseTo(0.9);
    expect(averageCoverage(emptySentenceRecords(2))).toBeNull();
  });
});

describe("official shadowing run", () => {
  it("starts a day with one open record per sentence", () => {
    const progress = startShadowing(null, "sintel", 2, 2, today);
    expect(progress.days[2]).toEqual({
      done: false,
      sentences: [
        { done: false, coverage: null },
        { done: false, coverage: null },
      ],
    });
    expect(startShadowing(progress, "sintel", 2, 2, today)).toBe(progress);
  });

  it("leaves other days untouched", () => {
    const base = createProgress("sintel", "2026-10-27");
    base.days[1] = { done: true, date: "2026-10-27", score: 0.6 };
    expect(startShadowing(base, "sintel", 3, 2, today).days[1]).toEqual(
      base.days[1],
    );
  });

  it("finishes the day with a date once every sentence is done", () => {
    let progress = startShadowing(null, "sintel", 2, 2, today);
    progress = submitShadowing(progress, 2, 0, { coverage: 0.9 }, today);
    expect(progress.days[2]?.done).toBe(false);
    progress = submitShadowing(progress, 2, 1, { manual: true }, today);
    expect(progress.days[2]).toEqual({
      done: true,
      date: today,
      sentences: [
        { done: true, coverage: 0.9 },
        { done: true, coverage: null },
      ],
    });
  });

  it("never changes a finished day", () => {
    let progress = startShadowing(null, "sintel", 2, 1, today);
    progress = submitShadowing(progress, 2, 0, { coverage: 0.75 }, today);
    expect(submitShadowing(progress, 2, 0, { coverage: 1 }, today)).toBe(
      progress,
    );
  });
});

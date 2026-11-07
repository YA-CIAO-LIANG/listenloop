import { describe, expect, it } from "vitest";
import { parseProgress } from "@/lib/progress";
import { emptySentenceRecords, recordAttempt } from "@/lib/shadowing";
import {
  browserLabel,
  cleanTroubleReport,
  isStuck,
} from "@/lib/shadowing-trouble";

const tries = (...coverages: number[]) =>
  coverages.map((coverage) => ({ coverage, heard: "x" }));

describe("isStuck (D52)", () => {
  it("needs 5 tries in a row under 50%", () => {
    expect(isStuck(tries(0.1, 0.2, 0.3, 0.4))).toBe(false);
    expect(isStuck(tries(0.1, 0.2, 0.3, 0.4, 0.49))).toBe(true);
    expect(isStuck(tries(0.1, 0.2, 0.3, 0.4, 0.5))).toBe(false);
  });
});

describe("skipping a sentence", () => {
  it("counts as done, keeps the best coverage, and is saved", () => {
    const records = recordAttempt(
      recordAttempt(emptySentenceRecords(2), 0, { coverage: 0.3 }),
      0,
      { skipped: true },
    );
    expect(records[0]).toEqual({ done: true, coverage: 0.3, skipped: true });
    // A later attempt keeps the mark.
    expect(recordAttempt(records, 0, { coverage: 0.4 })[0]).toEqual({
      done: true,
      coverage: 0.4,
      skipped: true,
    });
  });

  it("is valid progress", () => {
    const progress = {
      videoId: "v",
      week: 1,
      startedAt: "2026-11-07",
      status: "in-progress",
      history: [],
      days: {
        "2": {
          done: true,
          sentences: [{ done: true, coverage: 0.2, skipped: true }],
        },
      },
    };
    expect(parseProgress(progress)).not.toBeNull();
    progress.days["2"].sentences[0] = {
      done: true,
      coverage: 0.2,
      skipped: "yes" as never,
    };
    expect(parseProgress(progress)).toBeNull();
  });
});

describe("cleanTroubleReport", () => {
  const report = {
    videoId: "p-1",
    materialVersion: 2,
    sentenceIndex: 3,
    attempts: tries(0.2),
    browser: "Chrome 140 · macOS",
    skipped: true,
  };

  it("keeps a well-formed report and trims long text", () => {
    expect(cleanTroubleReport(report)).toEqual(report);
    const long = cleanTroubleReport({
      ...report,
      attempts: [{ coverage: 0, heard: "a".repeat(500) }],
    });
    expect(long?.attempts[0].heard).toHaveLength(300);
  });

  it.each([
    { ...report, videoId: "" },
    { ...report, sentenceIndex: -1 },
    { ...report, materialVersion: 0 },
    { ...report, attempts: [] },
    { ...report, attempts: [{ coverage: 2, heard: "" }] },
    { ...report, skipped: "no" },
    null,
  ])("rejects %j", (raw) => {
    expect(cleanTroubleReport(raw)).toBeNull();
  });
});

describe("browserLabel", () => {
  it.each([
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      "Chrome 140 · macOS",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
      "Edge 140 · Windows",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      "Safari 18 · iOS",
    ],
  ])("%s", (ua, label) => {
    expect(browserLabel(ua)).toBe(label);
  });
});

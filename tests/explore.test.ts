import { describe, expect, it } from "vitest";
import {
  filterPublicPractices,
  NO_FILTER,
  sentenceBucket,
  type PublicPracticeSummary,
} from "@/lib/custom-practice/explore";

const practice = (
  title: string,
  sourceLanguage: "en" | "zh",
  sentenceCount: number,
): PublicPracticeSummary => ({
  id: `p-${title}`,
  title,
  sourceLanguage,
  voice: "us-female",
  sentenceCount,
  createdAt: "2026-11-04T00:00:00Z",
  mine: false,
});

const list = [
  practice("Job Interview Basics", "en", 6),
  practice("搬家到台北", "zh", 12),
  practice("Campus Tour", "en", 40),
];

const titles = (found: PublicPracticeSummary[]) => found.map((p) => p.title);

describe("sentenceBucket", () => {
  it.each([
    [1, "short"],
    [10, "short"],
    [11, "medium"],
    [30, "medium"],
    [31, "long"],
    [300, "long"],
    [0, null],
  ])("%i sentences → %s", (count, bucket) => {
    expect(sentenceBucket(count)).toBe(bucket);
  });
});

describe("filterPublicPractices", () => {
  it("keeps everything with no filter", () => {
    expect(filterPublicPractices(list, NO_FILTER)).toEqual(list);
  });

  it("matches every query word in the title, in any order and case", () => {
    expect(
      titles(
        filterPublicPractices(list, { ...NO_FILTER, query: "  basics JOB " }),
      ),
    ).toEqual(["Job Interview Basics"]);
    expect(
      titles(filterPublicPractices(list, { ...NO_FILTER, query: "台北" })),
    ).toEqual(["搬家到台北"]);
    // Full-width letters match too.
    expect(
      titles(
        filterPublicPractices(list, { ...NO_FILTER, query: "ｃａｍｐｕｓ" }),
      ),
    ).toEqual(["Campus Tour"]);
    expect(
      filterPublicPractices(list, { ...NO_FILTER, query: "job tour" }),
    ).toEqual([]);
  });

  it("filters by source language and length, any of the chosen ones", () => {
    expect(
      titles(filterPublicPractices(list, { ...NO_FILTER, languages: ["zh"] })),
    ).toEqual(["搬家到台北"]);
    expect(
      titles(
        filterPublicPractices(list, {
          ...NO_FILTER,
          lengths: ["short", "long"],
        }),
      ),
    ).toEqual(["Job Interview Basics", "Campus Tour"]);
    expect(
      titles(
        filterPublicPractices(list, {
          query: "campus",
          languages: ["en"],
          lengths: ["short"],
        }),
      ),
    ).toEqual([]);
  });
});

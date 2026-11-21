import { describe, expect, it } from "vitest";
import {
  addToNotebook,
  dueToday,
  emptyNotebook,
  errorItems,
  isMastered,
  masteredPatterns,
  mergeNotebooks,
  parseNotebook,
  patternItems,
  REVIEWS_PER_DAY,
  reviewEntry,
} from "@/lib/writing/notebook";

const issue = {
  quote: "He go to school.",
  suggestion: "He goes to school.",
  why: "第三人稱單數",
  type: "verb" as const,
};

describe("the writing notebook's spacing (D187)", () => {
  it("brings an item back after 1, 3, and 7 days, then it's mastered", () => {
    let nb = addToNotebook(
      emptyNotebook(),
      errorItems("p", [issue]),
      "2026-11-01",
    );
    let [entry] = Object.values(nb.entries);
    expect(entry.due).toBe("2026-11-02");
    expect(dueToday(nb, "2026-11-01")).toHaveLength(0);
    expect(dueToday(nb, "2026-11-02")).toHaveLength(1);
    entry = reviewEntry(entry, true, "2026-11-02");
    expect(entry).toMatchObject({ stage: 1, due: "2026-11-05" });
    entry = reviewEntry(entry, true, "2026-11-05");
    expect(entry).toMatchObject({ stage: 2, due: "2026-11-12" });
    entry = reviewEntry(entry, true, "2026-11-12");
    expect(isMastered(entry)).toBe(true);
    nb = { entries: { [entry.id]: entry } };
    expect(dueToday(nb, "2026-12-31")).toHaveLength(0);
  });

  it("starts over at 1 day after a miss", () => {
    const nb = addToNotebook(
      emptyNotebook(),
      errorItems("p", [issue]),
      "2026-11-01",
    );
    const entry = reviewEntry(Object.values(nb.entries)[0], true, "2026-11-02");
    expect(reviewEntry(entry, false, "2026-11-05")).toMatchObject({
      stage: 0,
      due: "2026-11-06",
    });
  });

  it("doesn't add the same mistake twice, and skips unquoted ones", () => {
    let nb = addToNotebook(
      emptyNotebook(),
      errorItems("p", [issue]),
      "2026-11-01",
    );
    nb = addToNotebook(
      nb,
      errorItems("p", [issue, { ...issue, quote: "" }]),
      "2026-11-03",
    );
    expect(Object.keys(nb.entries)).toHaveLength(1);
  });

  it("mixes kinds and caps a day's reviews", () => {
    const patterns = Array.from({ length: 8 }, (_, i) => ({
      pattern: `P${i}`,
      example: `E${i}`,
      zh: "",
    }));
    const nb = addToNotebook(
      emptyNotebook(),
      [...errorItems("a", [issue]), ...patternItems("b", patterns)],
      "2026-11-01",
    );
    const due = dueToday(nb, "2026-11-02");
    expect(due).toHaveLength(REVIEWS_PER_DAY);
  });

  it("merges devices entry by entry, the later change winning", () => {
    const nb = addToNotebook(
      emptyNotebook(),
      errorItems("p", [issue]),
      "2026-11-01",
      new Date("2026-11-01T00:00:00Z"),
    );
    const id = Object.keys(nb.entries)[0];
    const reviewed = {
      entries: {
        [id]: reviewEntry(
          nb.entries[id],
          true,
          "2026-11-02",
          new Date("2026-11-02T00:00:00Z"),
        ),
      },
    };
    expect(mergeNotebooks(nb, reviewed).entries[id].stage).toBe(1);
    expect(mergeNotebooks(reviewed, nb).entries[id].stage).toBe(1);
  });

  it("counts mastered patterns and survives bad data", () => {
    expect(masteredPatterns(emptyNotebook())).toBe(0);
    expect(parseNotebook({ entries: { x: { kind: "nope" } } })).toEqual({
      entries: {},
    });
  });
});

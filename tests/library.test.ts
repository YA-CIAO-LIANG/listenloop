import { describe, expect, it } from "vitest";

import { VOICE_ACCENTS } from "@/lib/ai/types";
import type { PublicPracticeSummary } from "@/lib/custom-practice/explore";
import {
  activeFilterCount,
  estimateMinutes,
  filterLibrary,
  NO_LIBRARY_FILTER,
  parseLibraryParams,
  practiceLibraryItem,
  presentValues,
  videoLibraryItem,
  writeLibraryParams,
  type LibraryFilter,
  type LibraryItem,
} from "@/lib/library";
import { audioSeconds, PRACTICE_TIME_FACTOR } from "@/lib/library-config";
import { getAllVideos } from "@/lib/video-library";
import { videoAccents } from "@/lib/videos";

const item = (over: Partial<LibraryItem>): LibraryItem => ({
  id: "x",
  kind: "audio",
  title: "Title",
  subtitle: null,
  category: null,
  scenario: null,
  exam: null,
  examTarget: null,
  level: null,
  seconds: 90,
  accent: null,
  sentenceCount: 10,
  createdAt: "2026-11-01T00:00:00Z",
  sortOrder: null,
  learners: 0,
  ...over,
});

const filter = (over: Partial<LibraryFilter>): LibraryFilter => ({
  ...NO_LIBRARY_FILTER,
  ...over,
});

const ids = (items: LibraryItem[]) => items.map((i) => i.id);

describe("estimateMinutes", () => {
  it("is the length times the factor, rounded up", () => {
    expect(estimateMinutes(60)).toBe(PRACTICE_TIME_FACTOR);
    expect(estimateMinutes(61)).toBe(PRACTICE_TIME_FACTOR + 1);
  });

  it("is at least a minute", () => {
    expect(estimateMinutes(0)).toBe(1);
  });
});

describe("filterLibrary", () => {
  const items = [
    item({
      id: "a",
      kind: "video",
      title: "Sintel",
      subtitle: "少女尋找小龍",
      level: "intermediate",
      category: "talks-stories",
      scenario: null,
      seconds: 49,
      createdAt: "2026-10-24T00:00:00Z",
      learners: 5,
    }),
    item({
      id: "b",
      title: "Checking In",
      level: "beginner",
      category: "travel",
      scenario: null,
      accent: "gb",
      seconds: 200,
      sortOrder: 2,
      learners: 1,
    }),
    item({
      id: "c",
      title: "Water in Deserts",
      level: "advanced",
      category: "exam",
      scenario: null,
      accent: "us",
      seconds: 400,
      sortOrder: 1,
      createdAt: "2026-11-05T00:00:00Z",
    }),
  ];

  it("searches the title and subtitle, any case, every word", () => {
    expect(ids(filterLibrary(items, filter({ query: "SINTEL" })))).toEqual([
      "a",
    ]);
    expect(ids(filterLibrary(items, filter({ query: "小龍" })))).toEqual(["a"]);
    expect(
      ids(filterLibrary(items, filter({ query: "water deserts" }))),
    ).toEqual(["c"]);
    expect(filterLibrary(items, filter({ query: "water sintel" }))).toEqual([]);
  });

  it("keeps an item matching any chosen value of each filter", () => {
    expect(
      ids(filterLibrary(items, filter({ levels: ["beginner", "advanced"] }))),
    ).toEqual(["c", "b"]);
    expect(ids(filterLibrary(items, filter({ kinds: ["video"] })))).toEqual([
      "a",
    ]);
    expect(ids(filterLibrary(items, filter({ accents: ["gb"] })))).toEqual([
      "b",
    ]);
    expect(ids(filterLibrary(items, filter({ lengths: ["0-1"] })))).toEqual([
      "a",
    ]);
  });

  it("needs every filter to match", () => {
    expect(
      filterLibrary(
        items,
        filter({ categories: ["travel"], levels: ["advanced"] }),
      ),
    ).toEqual([]);
  });

  it("leaves out items without a value when that filter is on", () => {
    expect(
      ids(filterLibrary(items, filter({ accents: ["us", "gb"] }))),
    ).toEqual(["c", "b"]);
  });

  it("keeps what fits in the minutes chosen", () => {
    // 49 s × 4 → 4 min; 200 s → 14 min; 400 s → 27 min.
    expect(ids(filterLibrary(items, filter({ minutes: 10 })))).toEqual(["a"]);
    expect(ids(filterLibrary(items, filter({ minutes: 20 })))).toEqual([
      "b",
      "a",
    ]);
    expect(filterLibrary(items, filter({ minutes: 30 }))).toHaveLength(3);
  });

  it("sorts", () => {
    expect(ids(filterLibrary(items, filter({})))).toEqual(["c", "b", "a"]);
    expect(ids(filterLibrary(items, filter({ sort: "newest" })))).toEqual([
      "c",
      "b",
      "a",
    ]);
    expect(ids(filterLibrary(items, filter({ sort: "shortest" })))).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(ids(filterLibrary(items, filter({ sort: "popular" })))).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("recommends unordered items easiest and shortest first", () => {
    const loose = [
      item({ id: "hard", level: "advanced", seconds: 60 }),
      item({ id: "easy-long", level: "beginner", seconds: 300 }),
      item({ id: "easy-short", level: "beginner", seconds: 100 }),
    ];
    expect(ids(filterLibrary(loose, NO_LIBRARY_FILTER))).toEqual([
      "easy-short",
      "easy-long",
      "hard",
    ]);
  });
});

describe("library URL parameters", () => {
  it("round-trips a filter", () => {
    const chosen = filter({
      query: "coffee",
      kinds: ["audio"],
      categories: ["travel", "exam"],
      scenarios: ["hotel"],
      levels: ["beginner"],
      lengths: ["1-2"],
      accents: ["au"],
      minutes: 20,
      sort: "newest",
    });
    const params = writeLibraryParams(new URLSearchParams(), chosen);
    expect(params.toString()).toBe(
      "q=coffee&type=audio&cat=travel%2Cexam&sc=hotel&level=beginner&length=1-2&accent=au&min=20&sort=newest",
    );
    expect(parseLibraryParams(params)).toEqual(chosen);
  });

  it("leaves a plain library out of the URL, keeping other parameters", () => {
    const params = writeLibraryParams(
      new URLSearchParams("q=x&cat=travel&other=1"),
      NO_LIBRARY_FILTER,
    );
    expect(params.toString()).toBe("other=1");
  });

  it("drops unknown values", () => {
    const parsed = parseLibraryParams(
      new URLSearchParams(
        "type=film,audio&cat=nope&level=expert&accent=fr&min=15&sort=random",
      ),
    );
    expect(parsed).toEqual(filter({ kinds: ["audio"] }));
  });

  it("counts the filters on", () => {
    expect(activeFilterCount(NO_LIBRARY_FILTER)).toBe(0);
    // The time a day sits above the library, outside the panel (D79).
    expect(
      activeFilterCount(
        filter({ levels: ["beginner", "advanced"], minutes: 10, query: "x" }),
      ),
    ).toBe(2);
    expect(activeFilterCount(filter({ scenarios: ["hotel"] }))).toBe(1);
  });
});

describe("presentValues", () => {
  it("lists only the values some item has", () => {
    const present = presentValues([
      item({ kind: "video", level: "beginner", seconds: 30 }),
      item({ accent: "gb", category: "travel", seconds: 200 }),
    ]);
    expect(present.kinds).toEqual(["video", "audio"]);
    expect(present.levels).toEqual(["beginner"]);
    expect(present.accents).toEqual(["gb"]);
    expect(present.categories).toEqual(["travel"]);
    expect(present.lengths).toEqual(["0-1", "3-4"]);
  });
});

describe("library items", () => {
  it("maps every built-in video's category into the library's", () => {
    for (const video of getAllVideos()) {
      expect(videoLibraryItem(video).category).not.toBeNull();
    }
  });

  it("uses the same accent ids for videos and voices", () => {
    expect([...videoAccents]).toEqual([...VOICE_ACCENTS]);
  });

  const practice: PublicPracticeSummary = {
    id: "p-1",
    title: "Checking In",
    sourceLanguage: "en",
    voice: "gb-female",
    sentenceCount: 13,
    createdAt: "2026-11-07T00:00:00Z",
    mine: false,
    category: "travel",
    scenario: null,
    exam: null,
    examTarget: null,
    level: "beginner",
    subtitle: "在機場報到",
    sortOrder: 3,
  };

  it("makes a practice an audio item with its voice's accent", () => {
    expect(
      practiceLibraryItem(practice, { seconds: 70.4, learners: 2 }),
    ).toEqual(
      expect.objectContaining({
        kind: "audio",
        accent: "gb",
        category: "travel",
        scenario: null,
        level: "beginner",
        seconds: 70,
        learners: 2,
      }),
    );
  });

  it("estimates the length from the sentences when the audio's isn't known", () => {
    // 13 sentences × 12 words ÷ 130 words a minute = 72 s.
    expect(practiceLibraryItem(practice).seconds).toBe(72);
  });

  it("drops categories and levels it doesn't know", () => {
    const odd = practiceLibraryItem({
      ...practice,
      category: "nope",
      scenario: null,
      level: "expert",
    });
    expect(odd.category).toBeNull();
    expect(odd.level).toBeNull();
  });
});

describe("audioSeconds", () => {
  it("reads 48 kbit/s MP3 and 24 kHz WAV", () => {
    expect(audioSeconds(6000, "audio/mpeg")).toBe(1);
    expect(audioSeconds(48_044, "audio/wav")).toBe(1);
  });
});

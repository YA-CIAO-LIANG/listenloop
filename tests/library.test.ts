import { describe, expect, it } from "vitest";

import { VOICE_ACCENTS } from "@/lib/ai/types";
import type { PublicPracticeSummary } from "@/lib/custom-practice/explore";
import {
  activeFilterCount,
  filterLibrary,
  inCategories,
  inLength,
  NO_LIBRARY_FILTER,
  parseLibraryParams,
  practiceLibraryItem,
  presentValues,
  videoLibraryItem,
  writeLibraryParams,
  type LibraryFilter,
  type LibraryItem,
} from "@/lib/library";
import { CATEGORY_IDS } from "@/lib/categories";
import {
  audioSeconds,
  LIBRARY_LENGTHS,
  MAX_CATEGORIES,
} from "@/lib/library-config";
import {
  averageDaySeconds,
  dailyMinutes,
  dayEstimateSeconds,
} from "@/lib/library-time";
import { parseSavedFilter, savedFilterString } from "@/lib/library";
import { getAllVideos } from "@/lib/video-library";
import { videoAccents } from "@/lib/videos";

const item = (over: Partial<LibraryItem>): LibraryItem => ({
  id: "x",
  kind: "audio",
  title: "Title",
  titleZh: null,
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

describe("a day's practice time (D98)", () => {
  const material = { seconds: 60, sentenceCount: 10 };

  it("is length × 4 + 10 s a sentence for dictation, length × 3 for shadowing", () => {
    expect(dayEstimateSeconds("dictation", material)).toBe(340);
    expect(dayEstimateSeconds("shadowing", material)).toBe(180);
    // A week: 2 dictation days and 5 shadowing days.
    expect(averageDaySeconds(material)).toBeCloseTo((2 * 340 + 5 * 180) / 7);
    expect(dailyMinutes(material)).toBe(4);
    expect(dailyMinutes({ seconds: 0, sentenceCount: 0 })).toBe(1);
  });
});

describe("my default filter (D98)", () => {
  it("is saved as the URL query and read back the same way", () => {
    const chosen = filter({ levels: ["beginner"], length: "3-5" });
    const saved = savedFilterString(chosen);
    expect(saved).toBe("level=beginner&len=3-5");
    expect(parseSavedFilter(saved)).toEqual(chosen);
    expect(parseSavedFilter("")).toBeNull();
    expect(parseSavedFilter(42)).toBeNull();
  });
});

describe("filterLibrary", () => {
  const items = [
    item({
      id: "a",
      kind: "video",
      title: "Sintel",
      titleZh: null,
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
      titleZh: null,
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
      titleZh: null,
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
    expect(
      ids(filterLibrary(items, filter({ categories: ["travel", "exam"] }))),
    ).toEqual(["c", "b"]);
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

  it("keeps the audio length chosen (D104)", () => {
    // 49 s, 200 s, and 400 s.
    expect(ids(filterLibrary(items, filter({ length: "under-3" })))).toEqual([
      "a",
    ]);
    expect(ids(filterLibrary(items, filter({ length: "3-5" })))).toEqual(["b"]);
    expect(ids(filterLibrary(items, filter({ length: "5-10" })))).toEqual([
      "c",
    ]);
    expect(filterLibrary(items, filter({ length: "10-plus" }))).toEqual([]);
    expect(filterLibrary(items, filter({ length: "all" }))).toHaveLength(3);
  });

  it("keeps only what the server's search found, once it answers", () => {
    expect(
      ids(filterLibrary(items, filter({}), new Set(["a", "c", "zzz"]))),
    ).toEqual(["c", "a"]);
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

describe("the minutes I have today (D127)", () => {
  it("keeps materials whose average day fits, and counts as a filter", () => {
    // 90 s, 10 sentences: (2 × (360 + 100) + 5 × 270) / 7 ≈ 5.4 → 6 min;
    // 300 s, 30 sentences: (2 × 1,500 + 5 × 900) / 7 ≈ 17.9 → 18 min.
    const short = item({ id: "short" });
    const long = item({ id: "long", seconds: 300, sentenceCount: 30 });
    expect(ids(filterLibrary([short, long], filter({ minutes: 10 })))).toEqual([
      "short",
    ]);
    expect(ids(filterLibrary([short, long], filter({ minutes: 30 })))).toEqual([
      "short",
      "long",
    ]);
    expect(activeFilterCount(filter({ minutes: 10 }))).toBe(1);
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
      length: "5-10",
      accents: ["au"],
      minutes: 15,
      sort: "newest",
    });
    const params = writeLibraryParams(new URLSearchParams(), chosen);
    expect(params.toString()).toBe(
      "q=coffee&type=audio&cat=travel%2Cexam&sc=hotel&level=beginner&len=5-10&accent=au&min=15&sort=newest",
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
        "type=film,audio&cat=nope&level=expert&accent=fr&len=2-4&min=7&sort=random",
      ),
    );
    expect(parsed).toEqual(filter({ kinds: ["audio"] }));
  });

  it("keeps at most five categories", () => {
    const seven = CATEGORY_IDS.slice(0, 7);
    const parsed = parseLibraryParams(
      new URLSearchParams(`cat=${seven.join(",")}`),
    );
    expect(parsed.categories).toEqual(seven.slice(0, MAX_CATEGORIES));
  });

  it("counts the filters on", () => {
    expect(activeFilterCount(NO_LIBRARY_FILTER)).toBe(0);
    expect(
      activeFilterCount(
        filter({
          levels: ["beginner", "advanced"],
          length: "5-10",
          query: "x",
        }),
      ),
    ).toBe(3);
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
  });
});

describe("the length ranges and categories (D104)", () => {
  it("cover every whole second once, from 3, 5, and 10 minutes", () => {
    for (const seconds of [0, 179, 180, 299, 300, 599, 600, 3600, 179.4]) {
      const hits = LIBRARY_LENGTHS.filter(
        (l) => l.id !== "all" && inLength(seconds, l.id),
      );
      expect(hits, `${seconds}`).toHaveLength(1);
    }
    expect(inLength(179, "under-3")).toBe(true);
    expect(inLength(180, "3-5")).toBe(true);
    expect(inLength(600, "10-plus")).toBe(true);
  });

  it("matches any chosen category (overlaps)", () => {
    expect(inCategories("travel", [])).toBe(true);
    expect(inCategories("travel", ["exam", "travel"])).toBe(true);
    expect(inCategories(null, ["travel"])).toBe(false);
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
    titleZh: null,
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

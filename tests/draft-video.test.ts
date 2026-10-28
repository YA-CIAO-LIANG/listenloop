import { describe, expect, it } from "vitest";
import {
  addToIndex,
  draftVideo,
  estimateTimes,
  importName,
  type DraftMeta,
} from "@/lib/draft-video";
import { applyTaps, TAP_GAP } from "@/lib/player/tap-timing";
import { TODO_ZH, validateVideo } from "@/lib/videos";

const meta: DraftMeta = {
  id: "voa-lesson-7",
  youtubeId: "THMKsKMTyqg",
  title: "Let's Learn English Lesson 7",
  level: "beginner",
  category: "business",
  source: "VOA Learning English",
  attribution: {
    credit: "learningenglish.voanews.com",
    license: "Public Domain",
    licenseUrl: "https://learningenglish.voanews.com/p/6861.html",
    sourceUrl: "https://learningenglish.voanews.com/p/6861.html",
    transcriptUrl: "https://learningenglish.voanews.com/a/x/3240468.html",
    changes: "Excerpt; Chinese translation added by ListenLoop",
  },
  from: 5,
  to: 20,
};

describe("estimateTimes", () => {
  it("shares the excerpt out by word count, in order, with pauses", () => {
    const times = estimateTimes(["One two.", "One two three four."], 10, 16.3);
    expect(times[0].start).toBe(10);
    expect(times[1].end).toBe(16.3);
    // 6 s of speech: 2 words → 2 s, 4 words → 4 s, 0.3 s between.
    expect(times[0].end).toBe(12);
    expect(times[1].start).toBe(12.3);
  });
});

describe("draftVideo", () => {
  const draft = draftVideo(meta, ["Hello, Anna.", "", "  Hi, Pete!  "]);

  it("makes a valid draft with Chinese still to do", () => {
    expect(draft.draft).toBe(true);
    expect(draft.sentences.map((s) => s.en)).toEqual([
      "Hello, Anna.",
      "Hi, Pete!",
    ]);
    expect(draft.sentences.every((s) => s.zh === TODO_ZH)).toBe(true);
    expect(validateVideo(draft)).toEqual([]);
  });

  it("can't be published until the Chinese is written", () => {
    expect(validateVideo({ ...draft, draft: false })).toContain(
      `sentences[0].zh must be translated (only drafts may say ${TODO_ZH})`,
    );
    expect(validateVideo({ ...draft, draft: "yes" })).toContain(
      "draft must be true or false",
    );
  });
});

describe("addToIndex", () => {
  const index = `import { parseVideo, type Video } from "@/lib/videos";
import sintel from "./sintel.json";

export const videos: readonly Video[] = [sintel].map(parseVideo);
`;

  it("imports the new video and appends it to the list, once", () => {
    const next = addToIndex(index, "voa-lesson-7");
    expect(next).toContain(
      'import sintel from "./sintel.json";\nimport voaLesson7 from "./voa-lesson-7.json";',
    );
    expect(next).toContain("[sintel, voaLesson7].map(parseVideo)");
    expect(addToIndex(next, "voa-lesson-7")).toBe(next);
    expect(importName("cosmos-laundromat")).toBe("cosmosLaundromat");
  });
});

describe("applyTaps", () => {
  const sentences = [
    { i: 0, start: 0, end: 1, en: "A.", zh: "甲。" },
    { i: 1, start: 1, end: 2, en: "B.", zh: "乙。" },
    { i: 2, start: 2, end: 3, en: "C.", zh: "丙。" },
  ];

  it("starts each sentence at its tap and ends it just before the next", () => {
    const timed = applyTaps(sentences, [10.004, 12.5, 15], 17.25);
    expect(timed.map(({ start, end }) => [start, end])).toEqual([
      [10, 12.5 - TAP_GAP],
      [12.5, 15 - TAP_GAP],
      [15, 17.25],
    ]);
  });

  it("leaves sentences not tapped yet alone", () => {
    const timed = applyTaps(sentences, [10]);
    expect(timed[0]).toMatchObject({ start: 10, end: 13 });
    expect(timed[1]).toBe(sentences[1]);
  });
});

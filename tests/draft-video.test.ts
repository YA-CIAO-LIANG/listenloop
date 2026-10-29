import { describe, expect, it } from "vitest";
import {
  addToIndex,
  cuesToLines,
  draftVideo,
  draftVideoFromCues,
  estimateTimes,
  importName,
  parseSrt,
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
  collection: "blender-open-movies",
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

describe("subtitles (.srt)", () => {
  const srt =
    "﻿1\r\n00:00:23,000 --> 00:00:24,500\r\nYou're a jerk, Thom.\r\n\r\n" +
    "2\r\n00:00:25,000 --> 00:00:27,000\r\nLook Celia, we have to follow our passions;\r\n\r\n" +
    "3\r\n00:00:27,000 --> 00:00:30,500\r\n...you have your robotics, and I\r\njust want to be awesome in space.\r\n\r\n" +
    "4\r\n01:02:03,456 --> 01:02:04,000\r\nWhoaaa!\r\n";
  const cues = parseSrt(srt);

  it("reads numbers, times in seconds, and joins a cue's lines", () => {
    expect(cues).toHaveLength(4);
    expect(cues[0]).toEqual({
      index: 1,
      start: 23,
      end: 24.5,
      text: "You're a jerk, Thom.",
    });
    expect(cues[2].text).toBe(
      "...you have your robotics, and I just want to be awesome in space.",
    );
    expect(cues[3].start).toBe(3723.46);
  });

  it("picks a range of cues, minus the ones to skip", () => {
    expect(
      cuesToLines(cues, { from: 2, to: 4, skip: [4] }).map((l) => l.en),
    ).toEqual([
      "Look Celia, we have to follow our passions;",
      "...you have your robotics, and I just want to be awesome in space.",
    ]);
  });

  it("refuses a range or skip that doesn't match the file", () => {
    expect(() => cuesToLines(cues, { from: 3, to: 5 })).toThrow(
      "No subtitle number 5",
    );
    expect(() => cuesToLines(cues, { from: 1, to: 2, skip: [4] })).toThrow(
      "outside",
    );
    expect(() => cuesToLines(cues, { from: 4, to: 4, skip: [4] })).toThrow(
      "No subtitles left",
    );
  });

  it("makes a valid draft with the subtitles' own times", () => {
    // Extra keys from the .txt meta are ignored.
    const draft = draftVideoFromCues(
      { ...meta, cues: { from: 1, to: 3 } },
      cues,
    );
    expect(draft.draft).toBe(true);
    expect(draft.sentences.map(({ i, start, end }) => [i, start, end])).toEqual(
      [
        [0, 23, 24.5],
        [1, 25, 27],
        [2, 27, 30.5],
      ],
    );
    expect(draft.sentences.every((s) => s.zh === TODO_ZH)).toBe(true);
    expect(validateVideo(draft)).toEqual([]);
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

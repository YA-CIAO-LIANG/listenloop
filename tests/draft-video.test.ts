import { describe, expect, it } from "vitest";
import {
  addToIndex,
  cuesToLines,
  draftVideo,
  draftVideoFromCues,
  estimateTimes,
  importName,
  isYouTubeTranscript,
  parseSrt,
  parseYouTubeTranscript,
  TRANSCRIPT_GAP,
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

describe("merging subtitles into one sentence", () => {
  const cues = parseSrt(
    "1\n00:00:01,000 --> 00:00:02,000\nWell, Anna,\n\n" +
      "2\n00:00:02,000 --> 00:00:03,500\nwelcome.\n\n" +
      "3\n00:00:04,000 --> 00:00:05,000\nThank you.\n",
  );

  it("joins a run: first start, last end, text in order", () => {
    expect(cuesToLines(cues, { from: 1, to: 3, merge: [[1, 2]] })).toEqual([
      { start: 1, end: 3.5, en: "Well, Anna, welcome." },
      { start: 4, end: 5, en: "Thank you." },
    ]);
  });

  it("merges across a pause of up to 2 s, not longer", () => {
    const paused = parseSrt(
      "1\n00:00:01,000 --> 00:00:02,000\nI'm-\n\n" +
        "2\n00:00:04,000 --> 00:00:05,000\nI'm sorry.\n\n" +
        "3\n00:00:07,010 --> 00:00:08,000\nGood.\n",
    );
    expect(cuesToLines(paused, { from: 1, to: 2, merge: [[1, 2]] })).toEqual([
      { start: 1, end: 5, en: "I'm- I'm sorry." },
    ]);
    expect(() =>
      cuesToLines(paused, { from: 1, to: 3, merge: [[1, 3]] }),
    ).toThrow("merge 1–3 pauses 2.01 s before 3 (over 2 s)");
  });

  it("refuses a merge outside the range, backwards, or with a skip", () => {
    expect(() =>
      cuesToLines(cues, { from: 1, to: 2, merge: [[2, 3]] }),
    ).toThrow("not a run");
    expect(() =>
      cuesToLines(cues, { from: 1, to: 3, merge: [[2, 1]] }),
    ).toThrow("not a run");
    expect(() =>
      cuesToLines(cues, { from: 1, to: 3, skip: [2], merge: [[1, 2]] }),
    ).toThrow("both merged and skipped");
  });
});

describe("YouTube transcripts", () => {
  it("matches tap mode's gap between lines", () => {
    expect(TRANSCRIPT_GAP).toBe(TAP_GAP);
  });

  it("reads a time on its own line, then the text", () => {
    const cues = parseYouTubeTranscript(
      "﻿0:05\r\nCome in.\r\n0:07\r\nWell, Anna,\r\nwelcome.\r\n0:10\r\nThank you.\r\n",
    );
    expect(cues).toEqual([
      { index: 1, start: 5, end: 6.9, text: "Come in." },
      { index: 2, start: 7, end: 9.9, text: "Well, Anna, welcome." },
      // The last line's end is estimated (2 words × 0.4 s, at least 1 s).
      { index: 3, start: 10, end: 11, text: "Thank you." },
    ]);
  });

  it("reads a time before the text, hours, and skips duration labels", () => {
    const cues = parseYouTubeTranscript(
      "1:02:03 First line here.\n1 hour, 2 minutes, 7 seconds\n1:02:07\n5 秒\nSecond line.\n",
    );
    expect(cues.map(({ start, text }) => [start, text])).toEqual([
      [3723, "First line here."],
      [3727, "Second line."],
    ]);
    expect(cues[0].end).toBe(3726.9);
  });

  it("drops a time with no text, and refuses text before any time", () => {
    expect(
      parseYouTubeTranscript("0:01\n0:02\nHello.\n").map((c) => c.start),
    ).toEqual([2]);
    expect(() => parseYouTubeTranscript("Hello.\n0:02\nHi.\n")).toThrow(
      "before the first time",
    );
  });

  it("tells a transcript from a plain list of sentences", () => {
    expect(isYouTubeTranscript("\n0:05\nCome in.")).toBe(true);
    expect(isYouTubeTranscript("1:02:03 Hello.")).toBe(true);
    expect(isYouTubeTranscript("Come in.\nWell, Anna, welcome.")).toBe(false);
  });

  it("makes a valid draft through the same cue range", () => {
    const draft = draftVideoFromCues(
      { ...meta, cues: { from: 2, to: 3 } },
      parseYouTubeTranscript("0:05\nCome in.\n0:07\nWelcome.\n0:10\nThanks.\n"),
    );
    expect(draft.sentences.map((s) => [s.start, s.end, s.en])).toEqual([
      [7, 9.9, "Welcome."],
      [10, 11, "Thanks."],
    ]);
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

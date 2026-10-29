import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { videos } from "@/data/videos";
import { getAllVideos, getVideo } from "@/lib/video-library";
import {
  notesForSentence,
  parseVideo,
  validateVideo,
  videoCollections,
} from "@/lib/videos";
import en from "@/messages/en.json";
import zhHant from "@/messages/zh-Hant.json";

// Test fixture only (format checks); real content lives in data/videos.
const validVideo = {
  id: "voa-001",
  youtubeId: "abcdefghijk",
  title: "Sample",
  level: "beginner",
  category: "daily",
  collection: "blender-open-movies",
  source: "VOA Learning English",
  attribution: {
    credit: "learningenglish.voanews.com",
    license: "Public Domain",
    licenseUrl: "https://learningenglish.voanews.com/p/6861.html",
    sourceUrl: "https://learningenglish.voanews.com/p/6861.html",
    transcriptUrl: "https://learningenglish.voanews.com/a/example/1.html",
    changes: "Excerpt; Chinese translation added by ListenLoop",
  },
  sentences: [
    { i: 0, start: 1.2, end: 4.8, en: "Hello.", zh: "哈囉。" },
    { i: 1, start: 4.8, end: 7, en: "Goodbye.", zh: "再見。" },
  ],
  vocab: [
    {
      sentence: 0,
      word: "hello",
      pos: "int.",
      zh: "哈囉",
      example: "Hello there.",
    },
  ],
  grammar: [],
};

const withChanges = (changes: Record<string, unknown>) => ({
  ...validVideo,
  ...changes,
});

describe("validateVideo", () => {
  it("accepts a well-formed video", () => {
    expect(validateVideo(validVideo)).toEqual([]);
    expect(parseVideo(validVideo).id).toBe("voa-001");
  });

  it.each([
    ["id with uppercase", { id: "VOA-001" }, "id"],
    ["short youtubeId", { youtubeId: "abc" }, "youtubeId"],
    ["empty title", { title: "  " }, "title"],
    ["unknown level", { level: "expert" }, "level"],
    ["unknown category", { category: "news" }, "category"],
    ["unknown collection", { collection: "voa" }, "collection"],
    ["no collection", { collection: undefined }, "collection"],
    ["no sentences", { sentences: [] }, "sentences"],
    ["vocab not a list", { vocab: null }, "vocab"],
  ])("rejects %s", (_, changes, field) => {
    const problems = validateVideo(withChanges(changes));
    expect(problems.some((p) => p.startsWith(field))).toBe(true);
  });

  it("requires attribution with every field", () => {
    expect(validateVideo(withChanges({ attribution: undefined }))).toContain(
      "attribution must be an object",
    );
    const noCredit: Record<string, unknown> = { ...validVideo.attribution };
    delete noCredit.credit;
    expect(validateVideo(withChanges({ attribution: noCredit }))).toContain(
      "attribution.credit must be text",
    );
  });

  it.each(["Public Domain", "CC BY 3.0", "CC BY 4.0", "CC BY-SA 4.0"])(
    "allows the %s license",
    (license) => {
      const attribution = { ...validVideo.attribution, license };
      expect(validateVideo(withChanges({ attribution }))).toEqual([]);
    },
  );

  it.each([
    "CC BY-NC 4.0",
    "CC BY-ND 4.0",
    "CC BY-NC-SA 4.0",
    "CC BY-NC-ND 3.0",
    "All rights reserved",
    "public domain",
  ])(
    "rejects the %s license (no commercial use or no derivatives)",
    (license) => {
      const attribution = { ...validVideo.attribution, license };
      expect(validateVideo(withChanges({ attribution }))).toContain(
        "attribution.license must be Public Domain, CC BY x.x, or CC BY-SA x.x",
      );
    },
  );

  it("requires https URLs in attribution", () => {
    const attribution = {
      ...validVideo.attribution,
      licenseUrl: "http://creativecommons.org/licenses/by/3.0/",
    };
    expect(validateVideo(withChanges({ attribution }))).toContain(
      "attribution.licenseUrl must be an https URL",
    );
  });

  it("requires sentences numbered 0, 1, 2…", () => {
    const sentences = [
      { ...validVideo.sentences[0] },
      { ...validVideo.sentences[1], i: 2 },
    ];
    expect(validateVideo(withChanges({ sentences }))).toContain(
      "sentences[1].i must be 1",
    );
  });

  it("requires end after start", () => {
    const sentences = [{ ...validVideo.sentences[0], end: 1.2 }];
    expect(validateVideo(withChanges({ sentences }))).toContain(
      "sentences[0].end must be after start",
    );
  });

  it("rejects overlapping sentences", () => {
    const sentences = [
      { ...validVideo.sentences[0] },
      { ...validVideo.sentences[1], start: 4 },
    ];
    expect(validateVideo(withChanges({ sentences }))).toContain(
      "sentences[1].start must not be before the previous end",
    );
  });

  it("requires English and Chinese text", () => {
    const sentences = [{ ...validVideo.sentences[0], zh: "" }];
    expect(validateVideo(withChanges({ sentences }))).toContain(
      "sentences[0].zh must be text",
    );
  });

  it("checks every vocab and grammar field", () => {
    const problems = validateVideo(
      withChanges({
        vocab: [{ sentence: 0, word: "hi", pos: "", zh: "嗨", example: "Hi." }],
        grammar: [{ sentence: 0, point: "x" }],
      }),
    );
    expect(problems).toContain("vocab[0].pos must be text");
    expect(problems).toContain("grammar[0].explanation must be text");
  });

  it.each([
    ["missing", undefined],
    ["negative", -1],
    ["past the last sentence", 2],
    ["not a whole number", 0.5],
    ["text", "0"],
  ])("rejects a vocab or grammar sentence that is %s", (_, sentence) => {
    const problems = validateVideo(
      withChanges({
        vocab: [{ ...validVideo.vocab[0], sentence }],
        grammar: [
          { sentence, point: "Hello!", explanation: "打招呼", example: "Hi." },
        ],
      }),
    );
    expect(problems).toContain("vocab[0].sentence must be a sentence index");
    expect(problems).toContain("grammar[0].sentence must be a sentence index");
  });

  it("parseVideo lists every problem", () => {
    expect(() => parseVideo({})).toThrow(/youtubeId[\s\S]*sentences/);
  });
});

// Quality gate for real content: every file in data/videos must be valid.
const videosDir = join(process.cwd(), "data/videos");
const videoFiles = readdirSync(videosDir).filter((f) => f.endsWith(".json"));

describe("data/videos", () => {
  it("contains only video .json files and the index", () => {
    const others = readdirSync(videosDir).filter(
      (f) => !f.endsWith(".json") && f !== "index.ts",
    );
    expect(others).toEqual([]);
  });

  it.each(videoFiles)("%s is valid and named after its id", (file) => {
    const data = JSON.parse(readFileSync(join(videosDir, file), "utf8"));
    expect(validateVideo(data)).toEqual([]);
    expect(`${data.id}.json`).toBe(file);
  });

  it("lists every video file in data/videos/index.ts, once", () => {
    const listed = videos.map((video) => `${video.id}.json`);
    expect([...listed].sort()).toEqual([...videoFiles].sort());
    expect(new Set(listed).size).toBe(listed.length);
  });
});

describe("notesForSentence", () => {
  const vocab = (sentence: number, word: string) => ({
    sentence,
    word,
    pos: "n.",
    zh: "字",
    example: "Example.",
  });
  const video = {
    vocab: [vocab(1, "b"), vocab(0, "a"), vocab(1, "c")],
    grammar: [{ sentence: 1, point: "p", explanation: "e", example: "x" }],
  };

  it("returns one sentence's vocabulary and grammar in file order", () => {
    expect(notesForSentence(video, 1)).toEqual({
      vocab: [video.vocab[0], video.vocab[2]],
      grammar: video.grammar,
    });
    expect(notesForSentence(video, 2)).toEqual({ vocab: [], grammar: [] });
  });
});

describe("video library", () => {
  it("finds a video by id", () => {
    expect(getVideo("sintel")?.title).toBe("Sintel");
    expect(getVideo("missing")).toBeUndefined();
    expect(getAllVideos()).toEqual(videos.filter((v) => !v.draft));
  });
});

describe("collections", () => {
  it("each has a title and intro in both languages", () => {
    for (const messages of [zhHant, en]) {
      for (const id of videoCollections) {
        const names = (
          messages.collections as Record<
            string,
            { title: string; intro: string }
          >
        )[id];
        expect(names?.title, id).toBeTruthy();
        expect(names?.intro, id).toBeTruthy();
      }
    }
  });

  it("group the library in collection order, drafts and empty ones left out", async () => {
    const { vi } = await import("vitest");
    vi.resetModules();
    vi.doMock("@/lib/videos", async (original) => ({
      ...(await original<typeof import("@/lib/videos")>()),
      videoCollections: ["blender-open-movies", "empty-one", "second"],
    }));
    vi.doMock("@/data/videos", () => ({
      videos: [
        { ...validVideo, id: "b1", collection: "second" },
        { ...validVideo, id: "a1" },
        { ...validVideo, id: "a2", draft: true },
        { ...validVideo, id: "a3" },
      ],
    }));
    const library = await import("@/lib/video-library");
    expect(
      library
        .getVideosByCollection()
        .map(({ collection, videos }) => [collection, videos.map((v) => v.id)]),
    ).toEqual([
      ["blender-open-movies", ["a1", "a3"]],
      ["second", ["b1"]],
    ]);
    vi.doUnmock("@/lib/videos");
    vi.doUnmock("@/data/videos");
    vi.resetModules();
  });

  it("every published video belongs to a known collection", async () => {
    const library = await import("@/lib/video-library");
    const grouped = library
      .getVideosByCollection()
      .flatMap((group) => group.videos);
    expect(grouped).toHaveLength(getAllVideos().length);
  });
});

describe("drafts", () => {
  it("are hidden from the library and pages, but open in the timing tool", async () => {
    const { vi } = await import("vitest");
    vi.resetModules();
    vi.doMock("@/data/videos", () => ({
      videos: [
        { ...validVideo, id: "published" },
        { ...validVideo, id: "in-progress", draft: true },
      ],
    }));
    const library = await import("@/lib/video-library");
    expect(library.getAllVideos().map((v) => v.id)).toEqual(["published"]);
    expect(library.getVideo("in-progress")).toBeUndefined();
    expect(library.getVideoIncludingDrafts("in-progress")?.id).toBe(
      "in-progress",
    );
    vi.doUnmock("@/data/videos");
    vi.resetModules();
  });
});

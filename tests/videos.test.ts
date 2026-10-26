import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseVideo, validateVideo } from "@/lib/videos";

// Test fixture only (format checks); real content lives in data/videos.
const validVideo = {
  id: "voa-001",
  youtubeId: "abcdefghijk",
  title: "Sample",
  level: "beginner",
  category: "daily",
  source: "VOA Learning English",
  license: "public domain",
  sentences: [
    { i: 0, start: 1.2, end: 4.8, en: "Hello.", zh: "哈囉。" },
    { i: 1, start: 4.8, end: 7, en: "Goodbye.", zh: "再見。" },
  ],
  vocab: [{ word: "hello", pos: "int.", zh: "哈囉", example: "Hello there." }],
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
    ["no sentences", { sentences: [] }, "sentences"],
    ["vocab not a list", { vocab: null }, "vocab"],
  ])("rejects %s", (_, changes, field) => {
    const problems = validateVideo(withChanges(changes));
    expect(problems.some((p) => p.startsWith(field))).toBe(true);
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
        vocab: [{ word: "hi", pos: "", zh: "嗨", example: "Hi." }],
        grammar: [{ point: "x" }],
      }),
    );
    expect(problems).toContain("vocab[0].pos must be text");
    expect(problems).toContain("grammar[0].explanation must be text");
  });

  it("parseVideo lists every problem", () => {
    expect(() => parseVideo({})).toThrow(/youtubeId[\s\S]*sentences/);
  });
});

// Quality gate for real content: every file in data/videos must be valid.
const videosDir = join(process.cwd(), "data/videos");
const videoFiles = readdirSync(videosDir).filter((f) => f.endsWith(".json"));

describe("data/videos", () => {
  it("contains only .json files (besides .gitkeep)", () => {
    const others = readdirSync(videosDir).filter(
      (f) => !f.endsWith(".json") && f !== ".gitkeep",
    );
    expect(others).toEqual([]);
  });

  it.each(videoFiles)("%s is valid and named after its id", (file) => {
    const data = JSON.parse(readFileSync(join(videosDir, file), "utf8"));
    expect(validateVideo(data)).toEqual([]);
    expect(`${data.id}.json`).toBe(file);
  });
});

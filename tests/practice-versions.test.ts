import { describe, expect, it } from "vitest";
import { startNextWeek } from "@/lib/cycle";
import { startDictation } from "@/lib/dictation";
import {
  materialFromSnapshot,
  parseVersionParam,
  versionToShow,
} from "@/lib/practice-material";
import {
  createProgress,
  parseProgress,
  pinnedVersion,
  pinVersion,
  type Progress,
} from "@/lib/progress";
import { startShadowing } from "@/lib/shadowing";

const id = "p-00000000-0000-4000-8000-000000000001";

describe("pinning a week to a practice version (D44)", () => {
  it("fixes the version when the week's first day starts", () => {
    const started = startDictation(null, id, 1, 2, "2026-11-06", 3);
    expect(started.materialVersion).toBe(3);
    expect(pinnedVersion(started)).toBe(3);
    // Later days keep it, even if the practice has moved on.
    expect(
      startShadowing(started, id, 2, 2, "2026-11-07", 4).materialVersion,
    ).toBe(3);
  });

  it("treats a week begun before versions existed as version 1", () => {
    const legacy: Progress = {
      ...createProgress(id, "2026-11-01"),
      days: {
        1: { done: true, date: "2026-11-01", score: 0.5, answers: ["a"] },
      },
    };
    expect(pinnedVersion(legacy)).toBe(1);
    expect(pinVersion(legacy, 5)).toBe(legacy);
    expect(pinnedVersion(createProgress(id, "2026-11-01"))).toBeUndefined();
    expect(pinnedVersion(null)).toBeUndefined();
  });

  it("leaves built-in videos (no version) alone", () => {
    expect(
      startDictation(null, "sintel", 1, 2, "2026-11-06").materialVersion,
    ).toBeUndefined();
  });

  it("lets a new week take the latest version", () => {
    const repeat: Progress = {
      ...createProgress(id, "2026-11-01"),
      materialVersion: 2,
      status: "repeat",
    };
    const next = startNextWeek(repeat, "2026-11-09");
    expect("materialVersion" in next).toBe(false);
    expect(
      startDictation(next, id, 1, 2, "2026-11-09", 3).materialVersion,
    ).toBe(3);
  });

  it("checks the version in stored progress", () => {
    const progress = {
      ...createProgress(id, "2026-11-01"),
      materialVersion: 2,
    };
    expect(parseProgress(progress)).toEqual(progress);
    expect(parseProgress({ ...progress, materialVersion: 0 })).toBeNull();
    expect(parseProgress({ ...progress, materialVersion: "2" })).toBeNull();
  });
});

describe("versionToShow", () => {
  it("moves to the week's version, once", () => {
    expect(versionToShow(1, 2, null)).toBe(1);
    expect(versionToShow(1, 2, "3")).toBe(1);
    // Already asked for it (that version wasn't kept): stay, never loop.
    expect(versionToShow(1, 2, "1")).toBeNull();
  });

  it("stays when the versions match or nothing is pinned", () => {
    expect(versionToShow(2, 2, null)).toBeNull();
    expect(versionToShow(undefined, 2, null)).toBeNull();
    expect(versionToShow(1, undefined, null)).toBeNull();
  });
});

describe("parseVersionParam", () => {
  it.each([
    ["1", 1],
    ["12", 12],
    ["0", undefined],
    ["-1", undefined],
    ["1.5", undefined],
    ["abc", undefined],
    [undefined, undefined],
    [["1", "2"], undefined],
  ])("reads %j as %j", (value, expected) => {
    expect(parseVersionParam(value)).toBe(expected);
  });
});

describe("materialFromSnapshot", () => {
  const hash = "a".repeat(64);
  const snapshot = {
    practice_id: "00000000-0000-4000-8000-000000000001",
    version: 1,
    title: "第一版",
    sentences: [
      { en: "Go home.", zh: "回家。", audio_path: `${hash}.mp3`, notes: null },
    ],
    vocab: [{ sentence: 0, word: "home", pos: "n.", zh: "家", example: "Hi." }],
    grammar: [],
  };

  it("builds the earlier version's material", () => {
    const material = materialFromSnapshot(
      snapshot,
      (path) => `https://cdn/${path}`,
    );
    expect(material).toMatchObject({
      id: `p-${snapshot.practice_id}`,
      title: "第一版",
      version: 1,
      sentences: [{ i: 0, en: "Go home.", zh: "回家。" }],
      vocab: [{ sentence: 0, word: "home" }],
      audioUrls: [`https://cdn/${hash}.mp3`],
    });
  });

  it("rejects a broken snapshot", () => {
    expect(
      materialFromSnapshot({ ...snapshot, sentences: "x" }, String),
    ).toBeNull();
    expect(
      materialFromSnapshot(
        { ...snapshot, sentences: [{ en: "", zh: "" }] },
        String,
      ),
    ).toBeNull();
  });
});

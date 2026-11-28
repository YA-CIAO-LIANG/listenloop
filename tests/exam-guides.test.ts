import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { examGuides } from "@/data/exams";
import { writingPrompts } from "@/data/writing";
import { EXAMS } from "@/lib/categories";
import { examGuideProblems } from "@/lib/exam-guides";
import {
  EXAM_GUIDES,
  EXAM_TRACKS,
  findExamTrack,
  inListeningTrack,
  inWritingTrack,
} from "@/lib/exam-tracks";
import { WRITING_TYPES } from "@/lib/writing/types";

describe("exam English (D215)", () => {
  it("has a guide for every exam, each complete", () => {
    expect(examGuides.map((g) => g.id)).toEqual([...EXAM_GUIDES]);
    expect(
      readdirSync("data/exams").filter((f) => f.endsWith(".json")),
    ).toHaveLength(EXAM_GUIDES.length);
    for (const guide of examGuides) {
      expect(examGuideProblems(guide), guide.id).toEqual([]);
      for (const resource of guide.resources) {
        expect(resource.url).toMatch(/^https:\/\//);
        expect(resource.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("tracks point at real exams, targets, and writing kinds", () => {
    for (const track of EXAM_TRACKS) {
      expect(EXAM_GUIDES).toContain(track.guide);
      if (track.listening) {
        const exam = EXAMS.find((e) => e.id === track.listening.exam);
        expect(exam, track.id).toBeDefined();
        if ("target" in track.listening) {
          expect(exam!.targets.map((t) => t.id)).toContain(
            track.listening.target,
          );
        }
      }
      for (const type of track.writing?.types ?? []) {
        expect(WRITING_TYPES).toContain(type);
      }
    }
  });

  it("splits GEPT by level, in listening and in writing", () => {
    const elementary = findExamTrack("gept-elementary")!;
    expect(
      inListeningTrack(
        { exam: "gept", examTarget: "gept-elementary" },
        elementary,
      ),
    ).toBe(true);
    expect(
      inListeningTrack(
        { exam: "gept", examTarget: "gept-intermediate" },
        elementary,
      ),
    ).toBe(false);
    expect(
      inWritingTrack({ type: "gept", level: "beginner" }, elementary),
    ).toBe(true);
    expect(
      inWritingTrack({ type: "gept", level: "advanced" }, elementary),
    ).toBe(false);
  });

  it("has at least 8 writing prompts for every exam that writes (Joe, 2026-11-25)", () => {
    for (const track of EXAM_TRACKS.filter((t) => t.writing)) {
      const types = track.writing!.types as readonly string[];
      for (const type of types) {
        const count = writingPrompts.filter(
          (p) => p.type === type && inWritingTrack(p, findExamTrack(track.id)!),
        ).length;
        expect(count, `${track.id} ${type}`).toBeGreaterThanOrEqual(8);
      }
    }
  });
});

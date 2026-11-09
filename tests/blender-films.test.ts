import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BLENDER_FILMS,
  EXCERPT_SECONDS,
  excerptAttribution,
  excerptProblems,
  excerptSentences,
} from "@/lib/blender-films";
import { SUBTITLE_MAX } from "@/lib/videos";
import { excerptSeconds, storedAttribution } from "@/lib/youtube";

const srt = (file: string) => readFileSync(`data/subtitles/${file}`, "utf8");

describe("Blender open-movie excerpts (D118)", () => {
  for (const film of BLENDER_FILMS) {
    for (const excerpt of film.excerpts) {
      it(`${excerpt.key} is 1 to 3 minutes of clean sentences`, () => {
        const sentences = excerptSentences(srt(film.subtitles), excerpt);
        expect(excerptProblems(sentences)).toEqual([]);
        const seconds = excerptSeconds(sentences);
        expect(seconds).toBeGreaterThanOrEqual(EXCERPT_SECONDS.min);
        expect(seconds).toBeLessThanOrEqual(EXCERPT_SECONDS.max);
        for (const s of sentences) {
          expect(s.en).not.toMatch(/<|>/);
          expect(s.end).toBeGreaterThan(s.start);
        }
        expect([...excerpt.subtitle].length).toBeLessThanOrEqual(30);
        expect([...excerpt.subtitle].length).toBeLessThanOrEqual(SUBTITLE_MAX);
        expect(excerpt.titleZh).toMatch(/\p{Script=Han}/u);
      });
    }
  }

  it("keys are unique and excerpts of a film don't overlap", () => {
    const keys = BLENDER_FILMS.flatMap((f) => f.excerpts.map((e) => e.key));
    expect(new Set(keys).size).toBe(keys.length);
    for (const film of BLENDER_FILMS) {
      const sorted = [...film.excerpts].sort((a, b) => a.from - b.from);
      sorted.slice(1).forEach((e, k) => {
        expect(e.from).toBeGreaterThanOrEqual(sorted[k].to);
      });
    }
  });

  it("gives each excerpt a credit a material can store and show", () => {
    const film = BLENDER_FILMS[0];
    const sentences = excerptSentences(srt(film.subtitles), film.excerpts[0]);
    const credit = excerptAttribution(film, sentences);
    expect(storedAttribution(credit)).toEqual(credit);
    expect(credit.changes).toMatch(/^Excerpt \(0:15–3:14\)/);
  });

  it("refuses a stored credit with a missing field or a license we don't use", () => {
    const film = BLENDER_FILMS[1];
    const credit = excerptAttribution(film, []);
    expect(storedAttribution({ ...credit, credit: "" })).toBeNull();
    expect(
      storedAttribution({ ...credit, license: "CC BY-NC 4.0" }),
    ).toBeNull();
    expect(storedAttribution(null)).toBeNull();
  });
});

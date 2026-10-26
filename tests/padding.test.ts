import { describe, expect, it } from "vitest";
import { videos } from "@/data/videos";
import {
  DEFAULT_PADDING,
  PAD_AFTER,
  PAD_BEFORE,
  paddedSegment,
} from "@/lib/player/padding";

const s = (start: number, end: number) => ({ start, end });

describe("padding constants", () => {
  it("defaults to 0.15 s before and 0.25 s after", () => {
    expect(PAD_BEFORE).toBe(0.15);
    expect(PAD_AFTER).toBe(0.25);
    expect(DEFAULT_PADDING).toEqual({ before: 0.15, after: 0.25 });
  });
});

describe("paddedSegment", () => {
  it("adds padding when there is room on both sides", () => {
    const list = [s(1, 2), s(5, 8), s(12, 14)];
    expect(paddedSegment(list, 1)).toEqual({ start: 4.85, end: 8.25 });
  });

  it("never starts before the previous sentence ends", () => {
    const list = [s(1, 4.9), s(5, 8), s(12, 14)];
    expect(paddedSegment(list, 1).start).toBe(4.9);
  });

  it("never ends after the next sentence starts", () => {
    const list = [s(1, 2), s(5, 8), s(8.1, 10)];
    expect(paddedSegment(list, 1).end).toBe(8.1);
  });

  it("adds nothing when sentences touch", () => {
    const list = [s(1, 5), s(5, 8), s(8, 10)];
    expect(paddedSegment(list, 1)).toEqual({ start: 5, end: 8 });
  });

  it("doesn't go below 0 for the first sentence", () => {
    expect(paddedSegment([s(0.1, 2), s(3, 4)], 0).start).toBe(0);
  });

  it("pads the last sentence's end with no upper limit", () => {
    expect(paddedSegment([s(1, 2), s(3, 4)], 1).end).toBe(4.25);
  });

  it("accepts custom padding, including none", () => {
    const list = [s(1, 2), s(5, 8), s(12, 14)];
    expect(paddedSegment(list, 1, { before: 0.5, after: 1 })).toEqual({
      start: 4.5,
      end: 9,
    });
    expect(paddedSegment(list, 1, { before: 0, after: 0 })).toEqual({
      start: 5,
      end: 8,
    });
  });

  it("rounds away float noise", () => {
    // 107.25 - 0.15 is 107.10000000000001 in floating point.
    expect(paddedSegment([s(107.25, 110.5)], 0).start).toBe(107.1);
  });

  it("keeps every padded Sintel sentence inside its neighbors", () => {
    const { sentences } = videos.find((v) => v.id === "sintel")!;
    sentences.forEach((sentence, i) => {
      const { start, end } = paddedSegment(sentences, i);
      expect(start).toBeLessThanOrEqual(sentence.start);
      expect(end).toBeGreaterThanOrEqual(sentence.end);
      if (i > 0) expect(start).toBeGreaterThanOrEqual(sentences[i - 1].end);
      if (i < sentences.length - 1) {
        expect(end).toBeLessThanOrEqual(sentences[i + 1].start);
      }
    });
  });
});

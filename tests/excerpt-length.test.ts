import { describe, expect, it } from "vitest";
import { excerptSeconds, minutesAndSeconds } from "@/lib/excerpt-length";

const sentence = (start: number, end: number) => ({
  i: 0,
  start,
  end,
  en: "Hi.",
  zh: "嗨。",
});

describe("excerptSeconds", () => {
  it("runs from the first start to the last end, rounded to seconds", () => {
    expect(excerptSeconds([sentence(107.25, 110), sentence(200, 232.25)])).toBe(
      125,
    );
    expect(excerptSeconds([sentence(10, 69.4)])).toBe(59);
    expect(excerptSeconds([sentence(10, 69.5)])).toBe(60);
    expect(excerptSeconds([])).toBe(0);
  });
});

describe("minutesAndSeconds", () => {
  it("splits a length for the card label", () => {
    expect(minutesAndSeconds(100)).toEqual({ minutes: 1, seconds: 40 });
    expect(minutesAndSeconds(120)).toEqual({ minutes: 2, seconds: 0 });
  });
});

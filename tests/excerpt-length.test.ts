import { describe, expect, it } from "vitest";
import {
  excerptSeconds,
  LENGTH_BUCKETS,
  lengthBucket,
  minutesAndSeconds,
  parseLengthFilter,
} from "@/lib/excerpt-length";

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

describe("lengthBucket", () => {
  it("includes the lower bound and excludes the upper one", () => {
    expect(lengthBucket(59)).toBeNull();
    expect(lengthBucket(60)).toBe("1-2");
    expect(lengthBucket(119)).toBe("1-2");
    expect(lengthBucket(120)).toBe("2-3");
    expect(lengthBucket(479)).toBe("7-8");
    expect(lengthBucket(480)).toBe("8-plus");
    expect(lengthBucket(3600)).toBe("8-plus");
  });

  it("covers every second from one minute up, with no gaps or overlaps", () => {
    for (let i = 1; i < LENGTH_BUCKETS.length; i++) {
      expect(LENGTH_BUCKETS[i].min).toBe(LENGTH_BUCKETS[i - 1].max);
    }
  });
});

describe("parseLengthFilter", () => {
  it("keeps known ids in bucket order and drops the rest", () => {
    expect(parseLengthFilter("8-plus,1-2,nope,1-2")).toEqual(["1-2", "8-plus"]);
    expect(parseLengthFilter("")).toEqual([]);
    expect(parseLengthFilter(null)).toEqual([]);
  });
});

describe("minutesAndSeconds", () => {
  it("splits a length for the card label", () => {
    expect(minutesAndSeconds(100)).toEqual({ minutes: 1, seconds: 40 });
    expect(minutesAndSeconds(120)).toEqual({ minutes: 2, seconds: 0 });
  });
});

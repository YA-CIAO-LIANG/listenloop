import { describe, expect, it } from "vitest";
import {
  addMeasurement,
  estimateSeconds,
  GENERATION_SPEED,
  parseSpeed,
  remainingSeconds,
  roundForDisplay,
  secondsPerSentence,
} from "@/lib/custom-practice/estimate";

describe("generation time estimate (D95)", () => {
  it("guesses from the default until this device has measured", () => {
    expect(secondsPerSentence(null)).toBe(GENERATION_SPEED.secondsPerSentence);
    expect(estimateSeconds(20, 2.5)).toBe(50);
    expect(estimateSeconds(0, 2.5)).toBe(5);
  });

  it("averages measurements, keeping the last few", () => {
    let speed = addMeasurement(null, 40, 10); // 4 s a sentence
    expect(speed).toEqual({ secondsPerSentence: 4, samples: 1 });
    speed = addMeasurement(speed, 20, 10); // 2 s
    expect(speed).toEqual({ secondsPerSentence: 3, samples: 2 });
    for (let i = 0; i < 30; i++) speed = addMeasurement(speed, 10, 10);
    expect(speed!.samples).toBe(GENERATION_SPEED.samples);
    expect(speed!.secondsPerSentence).toBeCloseTo(1, 1);
    expect(addMeasurement(speed, 0, 10)).toBe(speed);
  });

  it("works out what's left from the job's own pace once it's going", () => {
    // 25% done in 10 s: 30 s more.
    expect(remainingSeconds(0.25, 10, 100)).toBe(30);
    // Just started: the estimate.
    expect(remainingSeconds(0, 1, 100)).toBe(100);
    expect(remainingSeconds(1, 50, 100)).toBe(0);
  });

  it("rounds for people", () => {
    expect(roundForDisplay(3)).toEqual({ minutes: 0, seconds: 10 });
    expect(roundForDisplay(41)).toEqual({ minutes: 0, seconds: 50 });
    expect(roundForDisplay(61)).toEqual({ minutes: 2, seconds: 0 });
  });

  it("validates what's saved", () => {
    expect(parseSpeed({ secondsPerSentence: 2, samples: 3 })).toEqual({
      secondsPerSentence: 2,
      samples: 3,
    });
    expect(parseSpeed({ secondsPerSentence: -1, samples: 3 })).toBeNull();
    expect(parseSpeed("fast")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  addMeasurement,
  estimateSeconds,
  GENERATION_SPEED,
  parseSpeed,
  remainingSeconds,
  roundForDisplay,
  secondsPerSentence,
  sitePace,
} from "@/lib/custom-practice/estimate";
import {
  countWords,
  estimateSeconds as audioSeconds,
  WORDS_PER_MINUTE,
} from "@/lib/custom-practice/generation";

describe("generation time estimate (D95)", () => {
  it("guesses from the default until this device has measured", () => {
    expect(secondsPerSentence(null)).toBe(GENERATION_SPEED.secondsPerSentence);
    expect(estimateSeconds(20, 2.5)).toBe(50);
    expect(estimateSeconds(0, 2.5)).toBe(5);
  });

  it("prefers the site's median of real times, then this device's (D142)", () => {
    const device = { secondsPerSentence: 4, samples: 2 };
    expect(secondsPerSentence(device)).toBe(4);
    expect(secondsPerSentence(device, 1.2)).toBe(1.2);
    expect(secondsPerSentence(null, 1.2)).toBe(1.2);
  });

  it("takes the site's median, ignoring odd jobs, once there are enough", () => {
    expect(
      sitePace([
        { seconds: 10, sentences: 10 },
        { seconds: 20, sentences: 10 },
      ]),
    ).toBeNull();
    expect(
      sitePace([
        { seconds: 10, sentences: 10 }, // 1 s
        { seconds: 30, sentences: 20 }, // 1.5 s
        { seconds: 3000, sentences: 10 }, // stuck: 300 s, dropped
        { seconds: 20, sentences: 10 }, // 2 s
        { seconds: 5, sentences: 0 }, // no sentences, dropped
        { seconds: 90, sentences: 10 }, // 9 s
      ]),
    ).toBe(1.75);
    expect(
      sitePace([
        { seconds: 10, sentences: 10 },
        { seconds: 15, sentences: 10 },
        { seconds: 40, sentences: 10 },
      ]),
    ).toBe(1.5);
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

  it("reads the length from the actual words at 150 a minute (D142)", () => {
    expect(WORDS_PER_MINUTE).toBe(150);
    const sentences = ["Where is the station?", "It is  near the park."];
    expect(countWords(sentences)).toBe(9);
    // 150 words: one minute.
    expect(audioSeconds([Array(150).fill("word").join(" ")])).toBe(60);
    expect(audioSeconds(sentences)).toBe(4);
  });

  it("rounds for people", () => {
    expect(roundForDisplay(3)).toEqual({ minutes: 0, seconds: 10 });
    expect(roundForDisplay(41)).toEqual({ minutes: 0, seconds: 50 });
    expect(roundForDisplay(61)).toEqual({ minutes: 1, seconds: 0 });
    expect(roundForDisplay(89)).toEqual({ minutes: 1, seconds: 0 });
    expect(roundForDisplay(90)).toEqual({ minutes: 2, seconds: 0 });
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

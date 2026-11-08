import { describe, expect, it } from "vitest";
import { isAndroid, mergeTranscript } from "@/lib/speech-transcript";

const pieces = (...texts: string[]) =>
  texts.map((transcript) => ({ transcript, isFinal: true }));

describe("mergeTranscript", () => {
  it("joins desktop Chrome's phrases once each", () => {
    expect(
      mergeTranscript([
        { transcript: "I moved to the city", isFinal: true },
        { transcript: " last year", isFinal: false },
      ]),
    ).toBe("I moved to the city last year");
  });

  it("keeps the longest when Android repeats everything so far", () => {
    expect(
      mergeTranscript(pieces("I", "I am", "I am going", "I am going home")),
    ).toBe("I am going home");
  });

  it("drops a phrase Android sends twice", () => {
    expect(mergeTranscript(pieces("I am going", "I am going"))).toBe(
      "I am going",
    );
    expect(
      mergeTranscript(pieces("we moved", "to the city", "to the city")),
    ).toBe("we moved to the city");
  });

  it("ignores case and punctuation when comparing", () => {
    expect(mergeTranscript(pieces("hello", "Hello, world."))).toBe(
      "Hello, world.",
    );
  });

  it("keeps a single word really said twice", () => {
    expect(mergeTranscript(pieces("no no", "no"))).toBe("no no no");
  });

  it("skips empty results and extra spaces", () => {
    expect(mergeTranscript(pieces("  ", " good   morning "))).toBe(
      "good morning",
    );
    expect(mergeTranscript([])).toBe("");
  });
});

describe("isAndroid", () => {
  it("detects Android Chrome but not desktop or iOS", () => {
    expect(
      isAndroid(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36",
      ),
    ).toBe(true);
    expect(
      isAndroid(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36",
      ),
    ).toBe(false);
    expect(
      isAndroid(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
      ),
    ).toBe(false);
  });
});

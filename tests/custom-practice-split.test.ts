import { describe, expect, it } from "vitest";
import {
  detectTextLanguage,
  splitSentences,
} from "@/lib/custom-practice/split";

describe("splitSentences: English", () => {
  it("splits after . ! ? when the next sentence starts with a capital", () => {
    expect(
      splitSentences(
        "We moved here. Do you like it? Yes! 3 cats live here.",
        "en",
      ),
    ).toEqual([
      "We moved here.",
      "Do you like it?",
      "Yes!",
      "3 cats live here.",
    ]);
  });

  it("keeps abbreviations, initials, decimals, and times together", () => {
    expect(
      splitSentences(
        "Mr. Smith paid $3.50 at 9 a.m. today. J. K. Rowling met Dr. Lee in the U.S. last year.",
        "en",
      ),
    ).toEqual([
      "Mr. Smith paid $3.50 at 9 a.m. today.",
      "J. K. Rowling met Dr. Lee in the U.S. last year.",
    ]);
  });

  it("keeps closing quotes with the sentence and doesn't break before lowercase", () => {
    expect(
      splitSentences('"Really?" she asked. "Yes." He nodded...', "en"),
    ).toEqual(['"Really?" she asked.', '"Yes."', "He nodded..."]);
  });

  it("treats every line as its own block and drops empty or symbol-only lines", () => {
    expect(
      splitSentences(
        "A: Hi there\r\n\r\nB: Hello\n  ---  \nC:   how   are you",
        "en",
      ),
    ).toEqual(["A: Hi there", "B: Hello", "C: how are you"]);
  });
});

describe("splitSentences: Chinese", () => {
  it("splits after full-width punctuation, keeping closing quotes", () => {
    expect(
      splitSentences(
        "我們搬到城市了。你呢？「好啊！」他說。今天，天氣很好",
        "zh",
      ),
    ).toEqual([
      "我們搬到城市了。",
      "你呢？",
      "「好啊！」",
      "他說。",
      "今天，天氣很好",
    ]);
  });

  it("splits on semicolons and ellipses, not commas", () => {
    expect(splitSentences("先吃飯；再出門……好嗎，可以", "zh")).toEqual([
      "先吃飯；",
      "再出門……",
      "好嗎，可以",
    ]);
  });
});

describe("detectTextLanguage", () => {
  it.each([
    ["我們搬到城市了。", "zh"],
    ["Hello, world.", "en"],
    ["I learned the word 你好 today in class.", "en"],
    ["今天學了 apple 這個字", "zh"],
    ["123 !!!", "en"],
  ] as const)("%j is %s", (text, language) => {
    expect(detectTextLanguage(text)).toBe(language);
  });
});

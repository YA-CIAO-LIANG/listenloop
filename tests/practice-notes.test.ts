import { describe, expect, it, vi } from "vitest";
import { fakeLanguage, fakeSpeech } from "@/lib/ai/fake";
import { INSTRUCTION_CHARS } from "@/lib/ai/budgets";
import { ProviderError, type LanguageProvider } from "@/lib/ai/types";
import {
  annotateMissing,
  annotateSentences,
  joinNotes,
  parseSentenceNotes,
  splitNotes,
  segmentCached,
  cleanNotes,
  NOTES_CHUNK,
  translateCached,
  type AiCache,
} from "@/lib/custom-practice/notes";
import { billed, memoryMeter, TEST_PRICE } from "./memory-meter";
import { NEWS_SENTENCES, NEWS_TEXT } from "./news-text";

const vocab = (sentence: number, word: string) => ({
  sentence,
  word,
  pos: "n.",
  zh: "中文",
  example: `An example with ${word}.`,
});
const grammar = (sentence: number, point: string) => ({
  sentence,
  point,
  explanation: "說明",
  example: "An example.",
});

function memoryCache(): AiCache & { entries: Map<string, unknown> } {
  const entries = new Map<string, unknown>();
  return {
    entries,
    get: async (hash) => entries.get(hash) ?? null,
    set: async (hash, _kind, result) => {
      entries.set(hash, result);
    },
  };
}

/** Deps with a priced language model: `limit` is in micro-dollars. */
function deps(language: LanguageProvider = fakeLanguage, limit = Infinity) {
  const meter = memoryMeter({ cost: limit });
  return {
    providers: {
      language: { ...language, price: TEST_PRICE },
      speech: fakeSpeech,
    },
    meter,
    cache: memoryCache(),
    reserve: meter.reserve,
  };
}

describe("cleanNotes", () => {
  it("keeps well-formed items and tidies whitespace", () => {
    expect(
      cleanNotes(
        {
          vocab: [{ ...vocab(0, " move  to "), pos: " v. " }],
          grammar: [grammar(1, "be + V-ing")],
        },
        2,
      ),
    ).toEqual({
      vocab: [
        {
          ...vocab(0, "move to"),
          pos: "v.",
          example: "An example with  move  to .".replace(/\s+/g, " ").trim(),
        },
      ],
      grammar: [grammar(1, "be + V-ing")],
    });
  });

  it("drops items with missing fields or bad sentence indexes", () => {
    const result = cleanNotes(
      {
        vocab: [
          { ...vocab(0, "ok") },
          { ...vocab(0, "nozh"), zh: "" },
          { ...vocab(5, "far") },
          { ...vocab(-1, "neg") },
          { ...vocab(0.5, "half") },
          "not an object",
          null,
        ],
        grammar: [{ ...grammar(0, "x"), explanation: 3 }],
      },
      2,
    );
    expect(result.vocab.map((v) => v.word)).toEqual(["ok"]);
    expect(result.grammar).toEqual([]);
  });

  it("allows 2 words and 1 grammar point per sentence, without repeats", () => {
    const result = cleanNotes(
      {
        vocab: [vocab(0, "a"), vocab(0, "b"), vocab(0, "c"), vocab(1, "A")],
        grammar: [grammar(0, "p"), grammar(0, "q"), grammar(1, "P")],
      },
      2,
    );
    expect(result.vocab.map((v) => v.word)).toEqual(["a", "b"]);
    expect(result.grammar.map((g) => g.point)).toEqual(["p"]);
  });

  it("survives output that isn't notes at all", () => {
    expect(cleanNotes("sorry, I can't", 3)).toEqual({ vocab: [], grammar: [] });
    expect(cleanNotes(null, 3)).toEqual({ vocab: [], grammar: [] });
  });

  it("shifts indexes for a later chunk", () => {
    expect(
      cleanNotes({ vocab: [vocab(1, "x")] }, 2, 40).vocab[0].sentence,
    ).toBe(41);
  });
});

describe("translateCached", () => {
  const zhToEn = { from: "zh-Hant", to: "en" } as const;

  it("translates once, then answers from the cache without counting", async () => {
    const d = deps();
    expect(await translateCached(d, ["你好", "再見"], zhToEn)).toEqual({
      ok: true,
      value: ["[en] 你好", "[en] 再見"],
    });
    expect(d.reserve).toHaveBeenCalledWith("cost", 4 + INSTRUCTION_CHARS);
    expect(await translateCached(d, ["你好", "再見"], zhToEn)).toEqual({
      ok: true,
      value: ["[en] 你好", "[en] 再見"],
    });
    expect(d.reserve).toHaveBeenCalledTimes(1);
  });

  it("rejects a translation with the wrong number of lines, and doesn't cache it", async () => {
    const d = deps({
      ...fakeLanguage,
      translate: vi.fn().mockResolvedValue(billed(["one"])),
    });
    expect(await translateCached(d, ["a", "b"], zhToEn)).toEqual({
      ok: false,
      reason: "failed",
    });
    expect(d.cache.entries.size).toBe(0);
  });

  it("spends nothing on nothing", async () => {
    const d = deps();
    expect(await translateCached(d, [], zhToEn)).toEqual({
      ok: true,
      value: [],
    });
    expect(d.reserve).not.toHaveBeenCalled();
  });
});

/** Distinct letter-only words, so the fake's notes don't repeat. */
const word = (i: number) =>
  "word" + String.fromCharCode(97 + Math.floor(i / 26), 97 + (i % 26));

describe("annotateSentences", () => {
  it("makes notes with indexes into the whole practice", async () => {
    const d = deps();
    const result = await annotateSentences(d, [
      "We moved here.",
      "Wonderful weather.",
    ]);
    expect(
      result.ok && result.value.vocab.map((v) => [v.sentence, v.word]),
    ).toEqual([
      [0, "moved"],
      [1, "wonderful"],
    ]);
    expect(result.ok && result.value.grammar.map((g) => g.sentence)).toEqual([
      0,
    ]);
  });

  it(`calls the model ${NOTES_CHUNK} sentences at a time, offsetting each chunk`, async () => {
    const annotate = vi.fn(fakeLanguage.annotate);
    const d = deps({ ...fakeLanguage, annotate });
    const sentences = Array.from(
      { length: NOTES_CHUNK + 5 },
      (_, i) => `${word(i)} here.`,
    );
    const result = await annotateSentences(d, sentences);
    expect(annotate).toHaveBeenCalledTimes(2);
    expect(annotate.mock.calls[1][0]).toHaveLength(5);
    expect(result.ok && result.value.vocab.at(-1)).toMatchObject({
      sentence: NOTES_CHUNK + 4,
      word: word(NOTES_CHUNK + 4),
    });
  });

  it("reuses cached chunks on a retry after a failure", async () => {
    const annotate = vi
      .fn(fakeLanguage.annotate)
      .mockImplementationOnce(fakeLanguage.annotate)
      .mockRejectedValueOnce(new ProviderError("busy", "429"));
    const d = deps({ ...fakeLanguage, annotate });
    const sentences = Array.from(
      { length: NOTES_CHUNK + 1 },
      (_, i) => `${word(i)} here.`,
    );
    expect(await annotateSentences(d, sentences)).toEqual({
      ok: false,
      reason: "busy",
    });
    // The first chunk is cached; only the second is asked again.
    expect((await annotateSentences(d, sentences)).ok).toBe(true);
    expect(annotate).toHaveBeenCalledTimes(3);
  });

  it("stops at the daily limit without calling the model", async () => {
    const annotate = vi.fn(fakeLanguage.annotate);
    const d = deps({ ...fakeLanguage, annotate }, 3);
    expect(await annotateSentences(d, ["Too long for the limit."])).toEqual({
      ok: false,
      reason: "limit",
    });
    expect(annotate).not.toHaveBeenCalled();
  });

  it("keeps the cache per provider, model, and prompt version", async () => {
    const d = deps();
    await annotateSentences(d, ["Hello there."]);
    const other = {
      ...d,
      providers: {
        ...d.providers,
        language: { ...fakeLanguage, id: "fake/v2" },
      },
    };
    const annotate = vi.spyOn(other.providers.language, "annotate");
    await annotateSentences(other, ["Hello there."]);
    expect(annotate).toHaveBeenCalledTimes(1);
  });
});

describe("segmentCached", () => {
  const text =
    'Dr. Smith arrived at 9:30 a.m. in the U.S. He said, "It\'s 90% done."\nThen he left.';
  const modelSplit = [
    [
      "Dr. Smith arrived at 9:30 a.m. in the U.S.",
      'He said, "It\'s 90% done."',
    ],
    ["Then he left."],
  ];

  it("splits by the model's answer once, then from the cache", async () => {
    const segment = vi.fn(async () => billed(modelSplit));
    const d = deps({ ...fakeLanguage, segment });
    const expected = [
      "Dr. Smith arrived at 9:30 a.m. in the U.S.",
      'He said, "It\'s 90% done."',
      "Then he left.",
    ];
    expect(await segmentCached(d, text, "en")).toEqual(expected);
    expect(await segmentCached(d, text, "en")).toEqual(expected);
    expect(segment).toHaveBeenCalledTimes(1);
    expect(d.reserve).toHaveBeenCalledTimes(1);
  });

  describe("falls back to the rules for the news text (D49)", () => {
    const failing = (segment: LanguageProvider["segment"]) =>
      deps({ ...fakeLanguage, segment });

    it.each([
      [
        "a config error",
        () =>
          Promise.reject(
            new ProviderError("config", "HTTP 401", undefined, {
              status: 401,
            }),
          ),
      ],
      ["an unexpected exception", () => Promise.reject(new TypeError("x"))],
      [
        "a throw before any promise",
        () => {
          throw new Error("sync");
        },
      ],
    ])("on %s", async (_, segment) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const d = failing(segment as LanguageProvider["segment"]);
      expect(await segmentCached(d, NEWS_TEXT, "en")).toEqual(NEWS_SENTENCES);
    });

    it("when the model takes too long", async () => {
      const d = failing(() => new Promise(() => {}));
      expect(await segmentCached(d, NEWS_TEXT, "en", 10)).toEqual(
        NEWS_SENTENCES,
      );
    });

    it("when the usage meter or cache can't be reached", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const d = deps();
      d.meter.reserve = vi.fn().mockRejectedValue(new Error("down"));
      d.cache.get = vi.fn().mockRejectedValue(new Error("down"));
      expect(await segmentCached(d, NEWS_TEXT, "en")).toEqual(NEWS_SENTENCES);
    });

    it("when the model straightens the apostrophes", async () => {
      const d = failing(async () =>
        billed(NEWS_SENTENCES.map((s) => [s.replace(/’/g, "'")])),
      );
      expect(await segmentCached(d, NEWS_TEXT, "en")).toEqual(NEWS_SENTENCES);
    });
  });

  it("uses the rules for a line the model rewrote", async () => {
    const d = deps({
      ...fakeLanguage,
      segment: async () => billed([modelSplit[0], ["Then, he left."]]),
    });
    expect((await segmentCached(d, text, "en")).at(-1)).toBe("Then he left.");
  });

  it("uses the rules when the model can't be called", async () => {
    const segment = vi.fn(async () => {
      throw new ProviderError("busy", "429");
    });
    const d = deps({ ...fakeLanguage, segment });
    expect(await segmentCached(d, "Hi there. Bye now.", "en")).toEqual([
      "Hi there.",
      "Bye now.",
    ]);
    const limited = deps({ ...fakeLanguage, segment }, 3);
    expect(await segmentCached(limited, "Hi there. Bye now.", "en")).toEqual([
      "Hi there.",
      "Bye now.",
    ]);
    expect(segment).toHaveBeenCalledTimes(1);
  });
});

describe("sentence-level caching (D43)", () => {
  const zhToEn = { from: "zh-Hant", to: "en" } as const;

  it("translates only the sentences not translated before, in any practice", async () => {
    const translate = vi.fn(fakeLanguage.translate);
    const d = deps({ ...fakeLanguage, translate });
    await translateCached(d, ["你好", "再見"], zhToEn);
    // Another practice sharing one sentence: only the new one is asked.
    expect(await translateCached(d, ["再見", "謝謝"], zhToEn)).toEqual({
      ok: true,
      value: ["[en] 再見", "[en] 謝謝"],
    });
    expect(translate).toHaveBeenCalledTimes(2);
    expect(translate.mock.calls[1][0]).toEqual(["謝謝"]);
    // All cached: no call at all.
    await translateCached(d, ["謝謝", "你好"], zhToEn);
    expect(translate).toHaveBeenCalledTimes(2);
  });

  it("annotates only sentences without notes or a cached result", async () => {
    const annotate = vi.fn(fakeLanguage.annotate);
    const d = deps({ ...fakeLanguage, annotate });
    await annotateMissing(d, ["We moved here."], [null], Infinity);
    const kept = { vocab: [], grammar: [] };
    const result = await annotateMissing(
      d,
      ["Already noted.", "We moved here.", "Wonderful weather."],
      [kept, null, null],
      Infinity,
    );
    expect(result.ok && result.value[0]).toBe(kept);
    expect(result.ok && result.value[1]?.vocab[0].word).toBe("moved");
    expect(annotate).toHaveBeenCalledTimes(2);
    expect(annotate.mock.calls[1][0]).toEqual(["Wonderful weather."]);
  });

  it("stops after its fresh calls, leaving the rest for later", async () => {
    const d = deps();
    const sentences = Array.from(
      { length: NOTES_CHUNK + 2 },
      (_, i) => `${word(i)} here.`,
    );
    const first = await annotateMissing(
      d,
      sentences,
      sentences.map(() => null),
      1,
    );
    expect(first.ok && first.value.filter(Boolean)).toHaveLength(NOTES_CHUNK);
  });

  it("splits and joins notes by sentence, keeping a repeated word once", () => {
    const notes = {
      vocab: [
        { sentence: 0, word: "go", pos: "v.", zh: "去", example: "Go." },
        { sentence: 1, word: "go", pos: "v.", zh: "去", example: "Go!" },
      ],
      grammar: [
        {
          sentence: 1,
          point: "let's + V",
          explanation: "說明",
          example: "Ok.",
        },
      ],
    };
    const each = splitNotes(notes, 2);
    expect(each[0].vocab).toEqual([
      { word: "go", pos: "v.", zh: "去", example: "Go." },
    ]);
    expect(each[1].grammar).toHaveLength(1);
    const joined = joinNotes(each);
    expect(joined.vocab.map((v) => v.sentence)).toEqual([0]);
    expect(joined.grammar.map((g) => g.sentence)).toEqual([1]);
  });

  it("checks stored notes", () => {
    expect(parseSentenceNotes(null)).toBeNull();
    expect(parseSentenceNotes({ vocab: "x", grammar: [] })).toBeNull();
    expect(
      parseSentenceNotes({
        vocab: [
          { word: "go", pos: "v.", zh: "去", example: "Go." },
          { word: "" },
        ],
        grammar: [],
      }),
    ).toEqual({
      vocab: [{ word: "go", pos: "v.", zh: "去", example: "Go." }],
      grammar: [],
    });
  });
});

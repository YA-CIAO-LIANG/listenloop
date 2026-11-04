import { describe, expect, it, vi } from "vitest";
import { fakeLanguage, fakeSpeech } from "@/lib/ai/fake";
import { ProviderError } from "@/lib/ai/types";
import {
  annotateSentences,
  cleanNotes,
  NOTES_CHUNK,
  translateCached,
  type AiCache,
} from "@/lib/custom-practice/notes";

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

function deps(language = fakeLanguage, limit = 100_000) {
  let used = 0;
  const reserve = vi.fn(async (_kind: string, chars: number) => {
    if (used + chars > limit) return false;
    used += chars;
    return true;
  });
  return {
    providers: { language, speech: fakeSpeech },
    meter: { reserve },
    cache: memoryCache(),
    reserve,
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
    expect(d.reserve).toHaveBeenCalledWith("translation", 4);
    expect(await translateCached(d, ["你好", "再見"], zhToEn)).toEqual({
      ok: true,
      value: ["[en] 你好", "[en] 再見"],
    });
    expect(d.reserve).toHaveBeenCalledTimes(1);
  });

  it("rejects a translation with the wrong number of lines, and doesn't cache it", async () => {
    const d = deps({
      ...fakeLanguage,
      translate: vi.fn().mockResolvedValue(["one"]),
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

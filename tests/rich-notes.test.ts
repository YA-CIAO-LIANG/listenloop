import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { fakeLanguage, fakeSpeech } from "@/lib/ai/fake";
import { badNotes } from "@/lib/custom-practice/edit";
import {
  annotateMissing,
  joinNotes,
  parseSentenceNotes,
  parseStoredNotes,
  richNotesFromModel,
  type AiCache,
} from "@/lib/custom-practice/notes";
import {
  cleanRichNotes,
  localDifficulty,
  type RichNotes,
} from "@/lib/custom-practice/rich-notes";
import { memoryMeter, TEST_PRICE } from "./memory-meter";

/** Version 2 notes (D67). */
const HARD =
  "If you're going to the library later, could you pick up the book I reserved for my history class?";
const { answer } = JSON.parse(
  readFileSync("tests/fixtures/notes-v2-hard.json", "utf8"),
);
const hard = (): Record<string, unknown> =>
  JSON.parse(JSON.stringify(answer.sentences[0]));

describe("localDifficulty", () => {
  it.each([
    ["Nice to meet you.", "easy"],
    [
      "I usually take the bus to school when it rains in the morning.",
      "medium",
    ],
    [HARD, "medium"],
    [
      "Although the professor explained the assignment carefully, several students, who had missed the previous lecture, still misunderstood the requirements completely.",
      "hard",
    ],
  ])("%s → %s", (en, difficulty) => {
    expect(localDifficulty(en)).toBe(difficulty);
  });
});

describe("cleanRichNotes", () => {
  it("keeps a hard sentence's full notes", () => {
    const notes = cleanRichNotes(hard(), HARD)!;
    expect(notes.difficulty).toBe("hard");
    expect(notes.chunks).toHaveLength(3);
    expect(notes.vocab[1]).toMatchObject({
      term: "reserve",
      inSentence: "reserved",
    });
    expect(notes.grammar[0].pitfall).toContain("原形動詞");
  });

  it("drops spans that aren't in the sentence", () => {
    const raw = hard();
    (raw.highlights as { text: string }[])[0].text = "check out";
    (raw.connected as { text: string }[])[0].text = "gonna go";
    (raw.vocab as { inSentence: string }[])[0].inSentence = "picked up";
    const notes = cleanRichNotes(raw, HARD)!;
    expect(notes.highlights.map((h) => h.text)).toEqual(["reserved"]);
    expect(notes.connected.map((c) => c.text)).not.toContain("gonna go");
    expect(notes.vocab[0].inSentence).toBe("");
  });

  it("calls a hard sentence medium when its chunks don't add up", () => {
    const raw = hard();
    (raw.chunks as { text: string }[])[2].text = "I reserved.";
    const notes = cleanRichNotes(raw, HARD)!;
    expect(notes.difficulty).toBe("medium");
    expect(notes.chunks).toEqual([]);
    expect(notes.grammar).toHaveLength(1);
  });

  it("gives an easy sentence key words only", () => {
    const en = "Nice to meet you.";
    const notes = cleanRichNotes(
      {
        difficulty: "easy",
        highlights: [{ text: "Nice to meet you", note: "打招呼" }],
        vocab: [
          {
            term: "meet",
            inSentence: "meet",
            kind: "word",
            pos: "v.",
            zh: "認識",
            ipa: "/miːt/",
            collocations: [],
            examples: [{ en: "We met at school.", zh: "我們在學校認識。" }],
          },
        ],
        grammar: [
          {
            point: "to + V",
            quote: "to meet",
            explanation: "不定詞",
            examples: [{ en: "Glad to see you.", zh: "很高興見到你。" }],
            pitfall: "",
          },
        ],
        chunks: [
          { text: "Nice", role: "main", zh: "好" },
          { text: "to meet you.", role: "modifier", zh: "認識你" },
        ],
        connected: [{ text: "meet you", soundsLike: "mee-chu", note: "連音" }],
      },
      en,
    )!;
    expect(notes).toMatchObject({
      difficulty: "easy",
      grammar: [],
      chunks: [],
      connected: [],
    });
    expect(notes.vocab).toHaveLength(1);
  });

  it("never calls a long, many-claused sentence easy", () => {
    const en =
      "Although the professor explained the assignment carefully, several students, who had missed the previous lecture, still misunderstood the requirements completely.";
    expect(cleanRichNotes({ difficulty: "easy" }, en)?.difficulty).toBe(
      "medium",
    );
  });

  it("needs examples with Chinese, and drops repeated words", () => {
    const raw = hard();
    const vocab = raw.vocab as Record<string, unknown>[];
    vocab[0].examples = [{ en: "No Chinese here." }];
    vocab[1].term = "Pick Up";
    const notes = cleanRichNotes(raw, HARD)!;
    expect(notes.vocab.map((v) => v.term)).toEqual(["Pick Up"]);
  });
});

describe("richNotesFromModel", () => {
  it("matches entries by index, and fills in what was left out", () => {
    const notes = richNotesFromModel({ sentences: [{ ...hard(), index: 1 }] }, [
      "Hello there.",
      HARD,
    ]);
    expect(notes[0]).toMatchObject({ v: 2, vocab: [], difficulty: "easy" });
    expect(notes[1].difficulty).toBe("hard");
  });
});

describe("stored notes in either format", () => {
  const rich = cleanRichNotes(hard(), HARD)!;
  const legacy = {
    vocab: [{ word: "home", pos: "n.", zh: "家", example: "I went home." }],
    grammar: [],
  };

  it("parses each as it was made", () => {
    expect(parseStoredNotes(rich, HARD)).toEqual(rich);
    expect(parseStoredNotes(legacy, "Go home.")).toEqual(legacy);
    expect(parseStoredNotes({ v: 3 }, "x")).toBeNull();
  });

  it("joins version 2 notes into the practice's lists, first example each", () => {
    const joined = joinNotes([legacy, rich]);
    expect(joined.vocab.map((v) => [v.sentence, v.word])).toEqual([
      [0, "home"],
      [1, "pick up"],
      [1, "reserve"],
    ]);
    expect(joined.vocab[1].example).toBe(
      "Can you pick up some milk on your way home?",
    );
    expect(parseSentenceNotes(rich)?.grammar).toHaveLength(1);
  });

  it("checks version 2 notes sent from the editor against their sentence", () => {
    expect(badNotes([{ en: HARD, notes: rich }])).toBeNull();
    const broken: RichNotes = {
      ...rich,
      vocab: [{ ...rich.vocab[0], examples: [] }],
    };
    expect(badNotes([{ en: HARD, notes: broken }])).toBe(0);
  });
});

describe("caching version 2 notes", () => {
  it("never reuses notes cached in the first format", async () => {
    const entries = new Map<string, unknown>();
    const cache: AiCache = {
      get: async (hash) => entries.get(hash) ?? null,
      set: async (hash, _kind, value) => void entries.set(hash, value),
    };
    const annotate = vi.fn(fakeLanguage.annotate);
    const deps = {
      providers: {
        language: { ...fakeLanguage, annotate, price: TEST_PRICE },
        speech: fakeSpeech,
      },
      meter: memoryMeter(),
      cache,
    };
    const first = await annotateMissing(deps, [HARD], [null], Infinity);
    expect(first.ok && first.value[0]).toMatchObject({ v: 2 });
    await annotateMissing(deps, [HARD], [null], Infinity);
    expect(annotate).toHaveBeenCalledTimes(1);
    // Every cache key is a version 2 one.
    for (const value of entries.values()) expect(value).toMatchObject({ v: 2 });
  });
});

describe("impossible reductions (D69)", () => {
  it("drops gonna/wanna before a place or thing, keeps them before a verb", () => {
    const en = "If you're going to the library later, I'm going to call you.";
    const notes = cleanRichNotes(
      {
        difficulty: "medium",
        connected: [
          { text: "you're going to", soundsLike: "yer gonna", note: "x" },
          {
            text: "I'm going to call",
            soundsLike: "I'm gonna call",
            note: "y",
          },
        ],
      },
      en,
    )!;
    expect(notes.connected.map((c) => c.note)).toEqual(["y"]);
  });
});

describe("difficulty bounds (D69)", () => {
  it("keeps a short question from being hard, and drops punctuation chunks", () => {
    const en = "What drink would you like to try today?";
    const notes = cleanRichNotes(
      {
        difficulty: "hard",
        chunks: [
          {
            text: "What drink would you like",
            role: "main",
            zh: "你想要哪種飲料",
          },
          { text: "to try today", role: "modifier", zh: "今天試試" },
          { text: "?", role: "connector", zh: "問句" },
        ],
      },
      en,
    )!;
    expect(notes.difficulty).toBe("medium");
    expect(notes.chunks).toEqual([]);
  });
});

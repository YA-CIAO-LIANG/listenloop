import { splitLine } from "@/lib/custom-practice/split";
import { countChars } from "@/lib/usage";
import { fakeWritingReview } from "@/lib/writing/fake-review";
import {
  ProviderError,
  type Billed,
  type Heard,
  type LanguageProvider,
  type SpeechAudio,
  type SpeechProvider,
  type TranscribeProvider,
} from "./types";

/** Free: no tokens, no cost; only the characters sent are counted. */
const free = <T>(value: T, input: readonly string[]): Billed<T> => ({
  value,
  usage: {
    inputTokens: 0,
    outputTokens: 0,
    chars: countChars(input),
    costUsd: 0,
  },
});

/**
 * Fake providers for tests and local development: no network, no cost,
 * and the same output for the same input.
 */
export const fakeLanguage: LanguageProvider = {
  id: "fake",
  checkConnection: async () => ({ ok: true }),
  price: { inputPerM: 0, outputPerM: 0 },
  // A fixed text about as long as asked, one line per sentence or turn.
  async compose({ scenario, words, format }) {
    const line =
      format === "dialogue"
        ? "Could you tell me more about it, please?"
        : "This is a practice sentence for listening.";
    const count = Math.max(1, Math.ceil(words / line.split(" ").length));
    return free(
      {
        title: `Practice: ${scenario}`.slice(0, 100),
        titleZh: "練習（測試）",
        subtitle: "測試用的練習內容",
        // The first general category, as a guess the learner can change (D153).
        category: "daily-life",
        lines: Array.from({ length: count }, () => line),
      },
      [scenario],
    );
  },
  // The title, as if it were a summary (D71).
  async describe({ title, text, titleEn, titleZh }) {
    return free(
      {
        titleEn: titleEn || "Listening Practice",
        titleZh: titleZh || "聽力練習",
        subtitle: `${title}（練習）`.slice(0, 60),
      },
      [title, text],
    );
  },
  // Rule-based feedback on an essay (WritingLoop, D187).
  async reviewWriting(input) {
    return free(fakeWritingReview(input), [input.task, input.essay]);
  },
  // Every translation passes (D115).
  async auditTranslations({ pairs }) {
    return free(
      { items: pairs.map((_, i) => ({ i, ok: true, issue: "" })) },
      pairs.flatMap((p) => [p.en, p.zh]),
    );
  },
  // A fixed story from the headline, about as long as asked (D100).
  async rewriteNews({ headline, words }) {
    const line = "Scientists shared new results with the public this week.";
    const count = Math.max(3, Math.ceil(words / line.split(" ").length));
    return free(
      {
        title: `News: ${headline}`.slice(0, 100),
        titleZh: "新聞（測試）",
        subtitle: "測試用的新聞內容",
        lines: Array.from({ length: count }, () => line),
      },
      [headline],
    );
  },
  // Fixed answers so tests can see each case (D96, D123): "N 句" or
  // "N sentences" keeps the first N; a style ("風", "style") rewrites
  // every line and adds one; "不用改"/"no change" changes nothing;
  // "危險"/"unsafe" is refused; "過濾"/"filter" is blocked by the safety
  // filter and "壞掉"/"broken" fails like a provider error. Anything else
  // changes the last line only.
  async revise({ lines, instruction }) {
    if (/過濾|filter/i.test(instruction)) {
      throw new ProviderError("filtered", "fake: content filter", undefined, {
        status: 400,
        code: "content_filter",
      });
    }
    if (/壞掉|broken/i.test(instruction)) {
      throw new ProviderError("failed", "fake: server error", undefined, {
        status: 500,
      });
    }
    if (/危險|unsafe/i.test(instruction)) {
      return free(
        {
          status: "refused",
          reason: "這個內容不適合學生，可以改成輕微懸疑。",
          lines,
        },
        [...lines, instruction],
      );
    }
    if (/不用改|no change/i.test(instruction)) {
      return free(
        { status: "unchanged", reason: "這段文字已經符合指令。", lines },
        [...lines, instruction],
      );
    }
    const count = instruction.match(/(\d+)\s*(句|sentence)/i);
    const revised = count
      ? lines.slice(0, Number(count[1]))
      : /風|style/i.test(instruction)
        ? [
            ...lines.map(
              (line) => `${line.replace(/[.!?]$/, "")}, in the dark.`,
            ),
            "Then the lights went out.",
          ]
        : lines.map((line, i) =>
            i === lines.length - 1
              ? `${line.replace(/[.!?]$/, "")} again.`
              : line,
          );
    return free({ status: "changed", reason: "", lines: revised }, [
      ...lines,
      instruction,
    ]);
  },
  // The rule-based split, as if the model agreed with it.
  async segment(lines, language) {
    return free(
      lines.map((line) => splitLine(line, language)),
      lines,
    );
  },
  async translate(texts, { to }) {
    return free(
      texts.map((text) => `[${to}] ${text}`),
      texts,
    );
  },
  // Each sentence's longest word as vocabulary; every third sentence gets
  // a grammar point on its first two words.
  async annotate(sentences) {
    return free(fakeNotes(sentences), sentences);
  },
};

/**
 * Version 2 notes (D67) made from the words themselves: the longest word
 * as vocabulary and key word, a grammar point on every third sentence,
 * and, for long sentences, two chunks split at the middle word and the
 * first two words as connected speech. Enough for every part of the
 * interface to show up in development and tests.
 */
function fakeNotes(sentences: readonly string[]) {
  const words = (sentence: string) => sentence.match(/[A-Za-z']+/g) ?? [];
  return {
    sentences: sentences.map((sentence, index) => {
      const list = words(sentence);
      const longest = [...list].sort((a, b) => b.length - a.length)[0];
      const pieces = sentence.split(/\s+/);
      const hard = pieces.length >= 12;
      const middle = Math.ceil(pieces.length / 2);
      return {
        index,
        difficulty: hard ? "hard" : list.length >= 7 ? "medium" : "easy",
        highlights: longest
          ? [{ text: longest, note: `[zh-Hant] ${longest}` }]
          : [],
        vocab: longest
          ? [
              {
                term: longest.toLowerCase(),
                inSentence: longest,
                kind: "word",
                pos: "n.",
                zh: `[zh-Hant] ${longest.toLowerCase()}`,
                ipa: "/fake/",
                collocations: [`a ${longest.toLowerCase()}`],
                examples: [
                  {
                    en: `An example with ${longest.toLowerCase()}.`,
                    zh: `[zh-Hant] 例句 ${longest.toLowerCase()}`,
                  },
                ],
              },
            ]
          : [],
        grammar:
          index % 3 === 0 && list.length >= 7
            ? [
                {
                  point: list.slice(0, 2).join(" "),
                  quote: list.slice(0, 2).join(" "),
                  explanation: `[zh-Hant] ${sentence}`,
                  examples: [{ en: sentence, zh: `[zh-Hant] ${sentence}` }],
                  pitfall: "[zh-Hant] pitfall",
                },
              ]
            : [],
        chunks: hard
          ? [
              {
                text: pieces.slice(0, middle).join(" "),
                role: "main",
                zh: "[zh-Hant] 1",
              },
              {
                text: pieces.slice(middle).join(" "),
                role: "modifier",
                zh: "[zh-Hant] 2",
              },
            ]
          : [],
        connected:
          list.length >= 7
            ? [
                {
                  text: list.slice(0, 2).join(" "),
                  soundsLike: list.slice(0, 2).join("-").toLowerCase(),
                  note: "[zh-Hant] linking",
                },
              ]
            : [],
      };
    }),
  };
}

const SAMPLE_RATE = 8000;
const SECONDS_PER_WORD = 0.4;

/**
 * Silent WAV audio, 0.4 s per word (at least 1 s), so players and timing
 * can be tested with a real, playable file.
 */
export function silentWav(seconds: number): Uint8Array {
  const samples = Math.round(seconds * SAMPLE_RATE);
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      bytes[offset + i] = text.charCodeAt(i);
    }
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE, true); // bytes per second (8-bit mono)
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  ascii(36, "data");
  view.setUint32(40, samples, true);
  bytes.fill(128, 44); // 8-bit PCM silence is the midpoint
  return bytes;
}

export const fakeSpeech: SpeechProvider = {
  id: "fake",
  checkConnection: async () => ({ ok: true }),
  async synthesize(text: string): Promise<Billed<SpeechAudio>> {
    const words = text.split(/\s+/).filter(Boolean).length;
    return free(
      {
        data: silentWav(Math.max(1, words * SECONDS_PER_WORD)),
        mimeType: "audio/wav",
      },
      [text],
    );
  },
};

/** What the fake speech to text "hears", picked by the piece's length. */
export const FAKE_HEARD = [
  "Thanks for joining us today.",
  "We are going to talk about how sleep works.",
  "Most adults need seven to nine hours a night.",
  "Let's look at what happens in the brain.",
] as const;

/**
 * Speech to text without a network (D130): a sentence from FAKE_HEARD by
 * the length of the audio (so the same piece gives the same text), heard
 * across the whole piece; nothing for pieces under a quarter second.
 */
export const fakeTranscriber: TranscribeProvider = {
  id: "fake-stt",
  checkConnection: async () => ({ ok: true }),
  async transcribe(_wav, seconds) {
    const heard: Heard =
      seconds < 0.25
        ? { text: "", offset: 0, duration: 0 }
        : {
            text: FAKE_HEARD[Math.round(seconds * 10) % FAKE_HEARD.length],
            offset: 0,
            duration: seconds,
          };
    return free(heard, []);
  },
};

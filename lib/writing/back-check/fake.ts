import { normalizeWords } from "@/lib/scoring/normalize";
import { meaningOverlap } from "../back-translation";
import type { BackCheckInput } from "./types";

/** Verb mistakes the fake checker notices (tests only). */
const WRONG_VERB = /\b(he|she|it) (go|do|have|like|want)\b|\bi (goes|has)\b/i;

/**
 * A rule-based stand-in for the AI check (D200), for tests and local
 * development: the meaning is right with most of the words (or Chinese
 * character pairs) there; a few verb mistakes are caught.
 */
export function fakeBackCheck(input: BackCheckInput) {
  return {
    items: input.items.map((item) => {
      if (item.mode === "listen-zh") {
        const meaning = meaningOverlap(item.meaning, item.answer) >= 0.3;
        return {
          i: item.i,
          meaning,
          meaningWhy: meaning ? "" : "（測試）少了原句的重要內容。",
          grammar: true,
          grammarWhy: "",
          better: "",
        };
      }
      const ref = new Set(normalizeWords(item.reference));
      const words = normalizeWords(item.answer);
      const shared = words.filter((w) => ref.has(w)).length;
      const meaning = ref.size > 0 && shared / ref.size >= 0.6;
      const grammar = !WRONG_VERB.test(item.answer);
      return {
        i: item.i,
        meaning,
        meaningWhy: meaning
          ? "（測試）用字不同，但說的是同一件事。"
          : "（測試）少了原句的重要內容。",
        grammar,
        grammarWhy: grammar ? "" : "（測試）動詞形式不對。",
        better: grammar ? "" : item.reference,
      };
    }),
  };
}

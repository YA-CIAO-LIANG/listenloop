import type { RichNotes } from "./custom-practice/rich-notes";
import { reviewKey } from "./review";
import type { VocabItem } from "./videos";

/**
 * A misheard word's notes for the review (D145): what it means, how it
 * sounds, and an example, from the material's own notes. No AI. The
 * review keeps the form heard in the sentence ("moved"), so it matches
 * the notes' form in the sentence first, then their base form ("move").
 */
export type ReviewNote = {
  /** As the notes teach it (base form), which may differ from the key. */
  term: string;
  pos: string;
  zh: string;
  /** IPA, from version 2 notes only. */
  ipa?: string;
  example?: { en: string; zh?: string };
};

/** The words of a phrase or form, to match a single word inside it. */
const words = (text: string) =>
  reviewKey(text)
    .split(/[^\p{L}'-]+/u)
    .filter(Boolean);

export function reviewNote(
  material: {
    vocab: readonly VocabItem[];
    richNotes?: readonly (RichNotes | null)[];
  },
  key: string,
  /** The sentence it was misheard in: its notes are tried first. */
  sentence?: number,
): ReviewNote | null {
  const target = reviewKey(key);
  const rich = (material.richNotes ?? []).flatMap((notes, i) =>
    (notes?.vocab ?? []).map((item) => ({ item, i })),
  );
  type Item = (typeof rich)[number]["item"];
  const rules: ((item: Item) => boolean)[] = [
    (v) => reviewKey(v.inSentence) === target,
    (v) => reviewKey(v.term) === target,
    (v) => v.kind === "word" && words(v.inSentence).includes(target),
  ];
  // This sentence's notes first (by every rule), then the rest.
  const find = (pool: typeof rich) => {
    for (const rule of rules) {
      const hit = pool.find(({ item }) => rule(item));
      if (hit) return hit.item;
    }
    return undefined;
  };
  const item =
    find(rich.filter(({ i }) => i === sentence)) ??
    find(rich.filter(({ i }) => i !== sentence));
  if (item && item.pos.trim() && item.zh.trim()) {
    const example = item.examples[0];
    return {
      term: item.term,
      pos: item.pos,
      zh: item.zh,
      ...(item.ipa.trim() ? { ipa: item.ipa.trim() } : {}),
      ...(example ? { example: { en: example.en, zh: example.zh } } : {}),
    };
  }
  const vocab =
    material.vocab.find(
      (v) => reviewKey(v.word) === target && v.sentence === sentence,
    ) ?? material.vocab.find((v) => reviewKey(v.word) === target);
  if (vocab && vocab.pos.trim() && vocab.zh.trim()) {
    return {
      term: vocab.word,
      pos: vocab.pos,
      zh: vocab.zh,
      ...(vocab.example ? { example: { en: vocab.example } } : {}),
    };
  }
  return null;
}

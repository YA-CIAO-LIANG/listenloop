/**
 * Teaching notes, version 2 (D67): as detailed as each sentence needs.
 * Every sentence gets a difficulty; easy ones get key words only, harder
 * ones grammar and the sounds that make them hard to hear, and hard ones
 * their structure in chunks with a translation for each chunk.
 *
 * Model output is never trusted: every field is checked and trimmed here,
 * spans that should quote the sentence must really be in it, and chunks
 * must add up to the sentence. What fails a check is dropped, not fixed.
 */

export const NOTES_VERSION = 2;

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export type Example = { en: string; zh: string };

export const VOCAB_KINDS = ["word", "phrase", "idiom"] as const;
export type VocabKind = (typeof VOCAB_KINDS)[number];

export type RichVocab = {
  /** As it's best learned (base form for verbs). */
  term: string;
  /** The words as they appear in the sentence, to match what was misheard. */
  inSentence: string;
  kind: VocabKind;
  pos: string;
  zh: string;
  /** IPA, e.g. "/ˈɡɑːrdn/"; empty for some idioms. */
  ipa: string;
  collocations: string[];
  examples: Example[];
};

export type RichGrammar = {
  point: string;
  /** The words in the sentence that show it. */
  quote: string;
  explanation: string;
  examples: Example[];
  /** A common mistake to avoid. */
  pitfall: string;
};

export const CHUNK_ROLES = [
  "main",
  "subordinate",
  "modifier",
  "connector",
] as const;
export type ChunkRole = (typeof CHUNK_ROLES)[number];

/** One meaning group of a hard sentence, with its own translation. */
export type Chunk = { text: string; role: ChunkRole; zh: string };

/** Why part of the sentence is hard to hear (linking, weak forms…). */
export type ConnectedSpeech = {
  text: string;
  soundsLike: string;
  note: string;
};

/** One of the sentence's 1–2 key words or phrases ("重點"). */
export type Highlight = { text: string; note: string };

export type RichNotes = {
  v: typeof NOTES_VERSION;
  difficulty: Difficulty;
  highlights: Highlight[];
  vocab: RichVocab[];
  grammar: RichGrammar[];
  /** Hard sentences only; empty otherwise. */
  chunks: Chunk[];
  /** Medium and hard sentences; empty when nothing is worth noting. */
  connected: ConnectedSpeech[];
};

/** How much each difficulty gets (the model is asked for the same). */
export const NOTES_LIMITS = {
  highlights: 2,
  vocab: { easy: 2, medium: 3, hard: 3 },
  grammar: { easy: 0, medium: 1, hard: 2 },
  connected: { easy: 0, medium: 2, hard: 3 },
  chunks: { min: 2, max: 8 },
  examples: 2,
  collocations: 3,
} as const;

const MAX = {
  short: 60,
  pos: 20,
  zh: 160,
  ipa: 80,
  text: 300,
  explanation: 400,
} as const;

const RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

const SUBORDINATORS =
  /\b(because|although|though|which|who|whom|whose|when|whenever|while|if|unless|since|whereas|whether|until|after|before|so that|even if|as soon as)\b/gi;

/**
 * A difficulty from the sentence alone (D67): length, clauses (joining
 * words and commas), and long words. The model judges vocabulary level
 * and connected speech too; this is a floor under its answer, so a long,
 * many-claused sentence is never called easy.
 */
export function localDifficulty(en: string): Difficulty {
  const words = en.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
  const clauses =
    (en.match(SUBORDINATORS)?.length ?? 0) + (en.match(/[,;:—]/g)?.length ?? 0);
  const longWords = words.filter(
    (w) => w.replace(/[^A-Za-z]/g, "").length >= 9,
  ).length;
  const score =
    (words.length >= 12 ? 1 : 0) +
    (words.length >= 22 ? 1 : 0) +
    (clauses >= 2 ? 1 : 0) +
    (longWords >= 3 ? 1 : 0);
  return score >= 3 ? "hard" : score >= 1 ? "medium" : "easy";
}

const str = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const tidy = value.replace(/\s+/g, " ").trim();
  return tidy && [...tidy].length <= max ? tidy : null;
};

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const field = (item: unknown, key: string): unknown =>
  typeof item === "object" && item !== null
    ? (item as Record<string, unknown>)[key]
    : undefined;

/** Straight quotes and squeezed spaces, lowercase: for finding spans. */
const fold = (text: string) =>
  text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .toLowerCase();

/** Whether `span` is part of `sentence` (case and quote style aside). */
export function inSentence(sentence: string, span: string): boolean {
  return span.length > 0 && fold(sentence).includes(fold(span));
}

function examples(value: unknown): Example[] {
  return list(value)
    .flatMap((item) => {
      const en = str(field(item, "en"), MAX.text);
      const zh = str(field(item, "zh"), MAX.text);
      return en && zh ? [{ en, zh }] : [];
    })
    .slice(0, NOTES_LIMITS.examples);
}

/**
 * One sentence's notes from the model, checked (D67), or null if the
 * answer isn't usable at all. `en` is the sentence the notes are for.
 */
export function cleanRichNotes(raw: unknown, en: string): RichNotes | null {
  if (typeof raw !== "object" || raw === null) return null;
  const said = field(raw, "difficulty");
  const modelDifficulty = (DIFFICULTIES as readonly unknown[]).includes(said)
    ? (said as Difficulty)
    : localDifficulty(en);
  // The local estimate is a floor: never easier than one step below it.
  const floor = Math.max(0, RANK[localDifficulty(en)] - 1);
  let difficulty = DIFFICULTIES[Math.max(RANK[modelDifficulty], floor)];

  const seenTerms = new Set<string>();
  const vocab = list(field(raw, "vocab")).flatMap((item): RichVocab[] => {
    const term = str(field(item, "term"), MAX.short);
    const pos = str(field(item, "pos"), MAX.pos);
    const zh = str(field(item, "zh"), MAX.zh);
    const kind = field(item, "kind");
    const surface = str(field(item, "inSentence"), MAX.text) ?? "";
    if (!term || !pos || !zh || seenTerms.has(term.toLowerCase())) return [];
    const exampleList = examples(field(item, "examples"));
    if (exampleList.length === 0) return [];
    seenTerms.add(term.toLowerCase());
    return [
      {
        term,
        inSentence: inSentence(en, surface) ? surface : "",
        kind: (VOCAB_KINDS as readonly unknown[]).includes(kind)
          ? (kind as VocabKind)
          : "word",
        pos,
        zh,
        ipa: str(field(item, "ipa"), MAX.ipa) ?? "",
        collocations: list(field(item, "collocations"))
          .flatMap((c) => str(c, MAX.short) ?? [])
          .slice(0, NOTES_LIMITS.collocations),
        examples: exampleList,
      },
    ];
  });

  const grammar = list(field(raw, "grammar")).flatMap((item): RichGrammar[] => {
    const point = str(field(item, "point"), MAX.short * 2);
    const explanation = str(field(item, "explanation"), MAX.explanation);
    const exampleList = examples(field(item, "examples"));
    if (!point || !explanation || exampleList.length === 0) return [];
    const quote = str(field(item, "quote"), MAX.text) ?? "";
    return [
      {
        point,
        quote: inSentence(en, quote) ? quote : "",
        explanation,
        examples: exampleList,
        pitfall: str(field(item, "pitfall"), MAX.explanation) ?? "",
      },
    ];
  });

  const highlights = list(field(raw, "highlights"))
    .flatMap((item): Highlight[] => {
      const text = str(field(item, "text"), MAX.text);
      const note = str(field(item, "note"), MAX.zh) ?? "";
      return text && inSentence(en, text) ? [{ text, note }] : [];
    })
    .slice(0, NOTES_LIMITS.highlights);

  const connected = list(field(raw, "connected")).flatMap(
    (item): ConnectedSpeech[] => {
      const text = str(field(item, "text"), MAX.text);
      const soundsLike = str(field(item, "soundsLike"), MAX.short);
      const note = str(field(item, "note"), MAX.explanation);
      return text && soundsLike && note && inSentence(en, text)
        ? [{ text, soundsLike, note }]
        : [];
    },
  );

  // Chunks must be the sentence, in order, nothing added or left out.
  let chunks = list(field(raw, "chunks")).flatMap((item): Chunk[] => {
    const text = str(field(item, "text"), MAX.text);
    const role = field(item, "role");
    const zh = str(field(item, "zh"), MAX.zh);
    return text && zh && (CHUNK_ROLES as readonly unknown[]).includes(role)
      ? [{ text, role: role as ChunkRole, zh }]
      : [];
  });
  const squeeze = (t: string) => fold(t).replace(/[^a-z0-9']/g, "");
  if (
    chunks.length < NOTES_LIMITS.chunks.min ||
    chunks.length > NOTES_LIMITS.chunks.max ||
    squeeze(chunks.map((c) => c.text).join(" ")) !== squeeze(en)
  ) {
    chunks = [];
  }
  // A hard sentence is explained by its chunks; without usable ones, it's
  // shown as medium.
  if (difficulty === "hard" && chunks.length === 0) difficulty = "medium";
  if (difficulty !== "hard") chunks = [];

  return {
    v: NOTES_VERSION,
    difficulty,
    highlights,
    vocab: vocab.slice(0, NOTES_LIMITS.vocab[difficulty]),
    grammar: grammar.slice(0, NOTES_LIMITS.grammar[difficulty]),
    chunks,
    connected: connected.slice(0, NOTES_LIMITS.connected[difficulty]),
  };
}

/** Stored notes of version 2, or null for anything else. */
export function parseRichNotes(value: unknown, en: string): RichNotes | null {
  if (field(value, "v") !== NOTES_VERSION) return null;
  return cleanRichNotes(value, en);
}

export const isRichNotes = (value: unknown): value is RichNotes =>
  field(value, "v") === NOTES_VERSION;

/** Notes for a sentence the model left out: nothing but a difficulty. */
export function emptyRichNotes(en: string): RichNotes {
  return {
    v: NOTES_VERSION,
    difficulty: localDifficulty(en) === "hard" ? "medium" : localDifficulty(en),
    highlights: [],
    vocab: [],
    grammar: [],
    chunks: [],
    connected: [],
  };
}

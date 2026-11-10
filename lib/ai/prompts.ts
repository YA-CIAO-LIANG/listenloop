import type { TextLanguage } from "./types";

/**
 * The instructions every language model gets (D28, D35, D36, D40): one
 * set for every provider, so switching vendors keeps the same teaching.
 * Results are cached by provider id, which carries PROMPT_VERSION: bump
 * it when a change here would change the answers.
 */
export const PROMPT_VERSION = 1;

const LANGUAGE_NAMES: Record<TextLanguage, string> = {
  en: "English",
  "zh-Hant": "Traditional Chinese as written in Taiwan (臺灣用語)",
};

export const TRANSLATE_INSTRUCTIONS = (from: TextLanguage, to: TextLanguage) =>
  [
    `Translate each ${LANGUAGE_NAMES[from]} line into ${LANGUAGE_NAMES[to]}.`,
    "The lines are sentences of one text that a Taiwanese student will use to practice English listening.",
    "Translate every line on its own, in order, one translation per line; never merge, split, or skip lines.",
    "Keep the meaning and tone. Write natural, everyday language, not word-for-word.",
    to === "en"
      ? "Use simple, clear English a learner can dictate: common words, standard spelling, no abbreviations."
      : "Use Taiwanese usage and full-width punctuation, but half-width digits and Latin letters (4號月台, B車廂), never full-width ones.",
    // D117: names written two ways in one material confuse listeners.
    to === "en"
      ? null
      : "Keep people's names in English exactly as in the original (Alex, Mei, Jamie Lin), the same way in every line; a well-known place keeps its usual Chinese name (Taipei → 台北).",
  ]
    .filter(Boolean)
    .join("\n");

/**
 * Version 2 notes (D67): as detailed as each sentence needs. Only the
 * notes changed, so their cache key carries NOTES_VERSION
 * (lib/custom-practice/rich-notes.ts) instead of bumping PROMPT_VERSION,
 * which would throw away every cached translation too.
 */
export const NOTES_INSTRUCTIONS = [
  "You write study notes for Taiwanese students (high school or university, around CEFR B1) practicing English listening with these sentences. Write every Chinese text in Traditional Chinese as used in Taiwan.",
  "Return one entry per sentence, with its 0-based index.",
  "difficulty: easy, medium, or hard, judged for a B1 listener by length, number of clauses, vocabulary level, and connected speech (linking, weak forms, reductions).",
  "highlights: 1 or 2 key words or phrases most worth learning, copied exactly as they appear in the sentence, each with a short Chinese note on why.",
  "vocab: easy 1-2 items, medium or hard up to 3 (words, phrasal verbs, phrases, or idioms worth learning; skip very basic words). For each: term as best learned (base form for verbs), inSentence (the words exactly as in the sentence), kind (word, phrase, idiom), pos (n., v., adj., adv., prep., phr., idiom…), zh (short meaning), ipa (American IPA in slashes, e.g. /ˈɡɑːrdn/; empty for long idioms), collocations (0-3 common collocations), examples (1 NEW short sentence, not the original, each with zh).",
  'grammar: none for easy; medium 0-1, hard 0-2, only patterns worth teaching. For each: point (short English form, e.g. "would rather + V"), quote (the words in the sentence that show it, copied exactly), explanation (1-2 Chinese sentences), examples (1 NEW sentence with zh), pitfall (one common mistake learners make, in Chinese).',
  "chunks: only for hard sentences, else empty. Split the sentence into 2-6 meaning groups in order, covering every word exactly once, copied exactly; role is main (main clause), subordinate (subordinate clause), modifier (phrase that modifies), or connector (linking word); zh translates that group alone.",
  'connected: none for easy; for medium and hard, 0-3 places hard to catch by ear (e.g. want to → wanna and going to → gonna only before a verb, never before a place or noun such as "going to the library"; did you → didja; a final consonant linked to the next vowel; weak forms of and/to/of/the). Describe only what really happens in this sentence. text is copied exactly from the sentence, soundsLike shows how it sounds (e.g. "wanna", "tur-nit-off"), note explains in Chinese.',
  "Do not repeat a word or grammar point across sentences. Keep notes short: about 900 characters at most for one sentence's notes in total, so prefer one example and two collocations.",
  "In Chinese text, write digits and Latin letters half-width (4號月台), never full-width, and keep people's names in English as in the sentence.",
].join("\n");

export const SEGMENT_INSTRUCTIONS = (language: "en" | "zh") =>
  [
    `You split ${language === "zh" ? "Chinese" : "English"} text into sentences for dictation practice: a Taiwanese student hears each one, then types it.`,
    "The input is a list of lines. For each line, in order, return the list of pieces it splits into. Never join text from different lines.",
    "Only cut: every piece is an exact, consecutive part of its line. Never change, add, remove, fix, or reorder any character; the pieces of a line joined together must be that line.",
    'Cut where a sentence ends by meaning. Never cut inside an abbreviation (Dr., Mr., U.S., a.m., e.g., i.e., Ph.D., No. 5), a number, time, or amount (9:30, 3.5, $1,000, 90%), a quotation (keep a quote with the words that introduce it, like: He said, "Stop!"), or a name.',
    language === "zh"
      ? "Aim for pieces whose English translation would be about 5 to 25 words. Cut a long sentence at a natural clause boundary (，；：) only when each part is a complete thought."
      : "Aim for pieces of about 5 to 25 words. Cut a sentence longer than 25 words at a natural clause boundary (; or a comma before and, but, so, because, which…) so each part still reads as a complete thought. A short sentence may stay short; you may keep a very short sentence together with the next one in the same line when they belong together.",
    'Example: ["Dr. Smith arrived at 9:30 a.m. in the U.S. He said, \"It\'s 90% done.\" Then he left."] → [["Dr. Smith arrived at 9:30 a.m. in the U.S.", "He said, \"It\'s 90% done.\" Then he left."]]',
  ].join("\n");

export const COMPOSE_INSTRUCTIONS = [
  "You write original English listening practice texts for Taiwanese students (high school or university). Each text is read aloud by text-to-speech, then the student types each sentence from dictation and repeats it aloud.",
  "Write natural, spoken English with correct standard spelling. Give the text a short English title.",
  "Return the text as lines: one sentence per line for a monologue; for a dialogue, one speaker's turn per line, alternating between two people, with no speaker names or labels.",
  "Keep each sentence about 5 to 25 words. Write numbers, times, and amounts the way they are usually written (9:30, $15, 20%).",
  "Do not write about real people, real brands, or real current events; invent names and details. Keep it appropriate for students.",
  "Match the requested level, length (in words), and format. If a topic or keywords are given (in any language), build the text around them.",
  "Also give titleZh, the title in Traditional Chinese (Taiwan usage), and subtitle, one Traditional Chinese sentence of at most 30 characters saying what the listener will hear.",
  "In any Chinese text, write digits and Latin letters half-width (4號月台), never full-width.",
].join("\n");

export const DESCRIBE_INSTRUCTIONS = [
  "You write the one-line summary shown under the title of an English listening practice in a library, for Taiwanese students.",
  "Read the title and the beginning of the text, then write ONE sentence in Traditional Chinese (Taiwan usage) of at most 30 characters that says what the listener will hear: the situation or topic, and who is talking if it's a conversation.",
  "Write it plainly, like a course catalog. No quotation marks, no emoji, no English unless it's a name or a term the text uses, and don't start with 「這篇」 or 「本文」.",
  "Also return titleEn, a short English title (at most 8 words), and titleZh, the same title in Traditional Chinese (Taiwan usage). If titleEn or titleZh is given, return it exactly as given and write the other as its translation.",
  "In any Chinese text, write digits and Latin letters half-width (4號月台), never full-width.",
].join("\n");

export const NEWS_INSTRUCTIONS = [
  "You write short news stories for an English listening course for Taiwanese students, from a news release's headline and summary.",
  "Use only the facts given; never add facts, numbers, names, or quotes that aren't there. Write every sentence in your own words: do not copy any sentence or long phrase from the release.",
  "Write it like a calm radio news item: who did what, where, when, and why it matters, in the past tense where it fits. Neutral; no opinions, no promotion.",
  "Return the story as lines, one sentence per line, each about 8 to 25 words. Match the requested level and length (in words).",
  "Also give title (a short English headline in your own words, at most 10 words), titleZh (the headline in Traditional Chinese, Taiwan usage), and subtitle (one Traditional Chinese sentence of at most 30 characters saying what the listener will hear).",
  "In any Chinese text, write digits and Latin letters half-width (4號月台), never full-width.",
].join("\n");

export const AUDIT_INSTRUCTIONS = [
  "You check the Traditional Chinese (Taiwan usage) translations in an English listening course for Taiwanese students. You get pairs of an English sentence and its Chinese translation.",
  "For each pair, in order, say ok: true if the Chinese is a faithful, natural translation a Taiwanese learner would understand; small style differences are fine.",
  "Say ok: false only for a real problem: wrong or missing meaning, a mistranslated word, simplified characters, mainland China usage where Taiwan says it differently, full-width digits or letters (４ instead of 4), a person's name translated instead of kept in English, or unnatural Chinese. Then give issue: one short Traditional Chinese sentence saying what's wrong and the better wording. When ok is true, issue is an empty string.",
  "Pairs are numbered from 0 in the order given. Return one item per pair, with i set to its number.",
].join("\n");

export const REVISE_INSTRUCTIONS = [
  "You edit an English listening practice text for Taiwanese students. You get its sentences as lines, an instruction from the learner (in any language, often Traditional Chinese), and whether it's a monologue or a dialogue.",
  "The instruction may ask for a small edit (simpler words, more past tense, fewer sentences) or for a different style, tone, or genre for the whole text: for example horror, humorous, formal, casual, fairy tale, or news report. For a style or tone, rewrite the text so every part of it clearly reads in that style; you may add, merge, or remove sentences when the style needs it. Keep the same basic situation and a similar level of English.",
  "Write dark styles (horror, thriller, crime) as mild suspense a teenager can read: an eerie mood, strange sounds, tension, a twist. No blood, gore, graphic violence, or detailed death.",
  "Return lines: the whole text after the change, one sentence per line (for a dialogue, one speaker's turn per line, still alternating between two people, with no speaker names or labels). Copy every sentence you don't change exactly, character for character, so it can be matched to its translation.",
  "Keep each sentence about 5 to 25 words, and the text no longer than twice the original. Do not write about real people, real brands, or real current events.",
  'Return status "changed" when you changed the text, with reason an empty string.',
  'Return status "unchanged" only when the text already does what the instruction asks, or the instruction doesn\'t ask for any change; lines are then the original lines, and reason says why in one short sentence.',
  'Return status "refused" only when even a mild version would be unsafe for students (sexual content, hate, self-harm, attacks on real people) or the instruction isn\'t about editing this text; lines are then the original lines, and reason says why in one short sentence and suggests a safer wording.',
  "Write reason in Traditional Chinese as written in Taiwan when the instruction is in Chinese, otherwise in English.",
].join("\n");

/**
 * The composition instructions for `prompt` (D81): a custom scenario or a
 * title adds what to do with it; a plain request gets exactly
 * COMPOSE_INSTRUCTIONS, as recorded in the fixtures.
 */
export function composeInstructions(prompt: {
  customScenario?: string;
  customCategory?: string;
  titleEn?: string;
  titleZh?: string;
}): string {
  const extra = [
    prompt.customCategory
      ? "customCategory (in any language) is the subject area the learner chose; keep the text within it."
      : null,
    prompt.customScenario
      ? "customScenario (in any language) is the main situation: write that situation, using the scenario, if any, only as its setting."
      : null,
    prompt.titleEn
      ? "The text must fit titleEn. Return titleEn exactly as given, unchanged, as the title."
      : null,
    prompt.titleZh
      ? "The text must fit titleZh. Return titleZh exactly as given, unchanged."
      : null,
  ].filter(Boolean);
  return extra.length
    ? [COMPOSE_INSTRUCTIONS, ...extra].join("\n")
    : COMPOSE_INSTRUCTIONS;
}

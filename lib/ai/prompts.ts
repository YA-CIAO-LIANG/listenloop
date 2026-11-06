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
      : "Use Taiwanese usage and full-width punctuation.",
  ].join("\n");

export const NOTES_INSTRUCTIONS = [
  "You write study notes for Taiwanese students (high school or university, around CEFR B1) practicing English listening with these sentences.",
  "For each sentence, choose 0 to 2 vocabulary items (a word or a short phrase) most worth learning; skip very basic words.",
  "For each item give: the sentence index (0-based), the word as it is best learned (base form for verbs), its part of speech (n., v., adj., adv., prep., phr., …), a short meaning in Traditional Chinese as used in Taiwan, and a NEW short English example sentence (not the original sentence).",
  "Choose 0 or 1 grammar point per sentence, only when the sentence shows a pattern worth teaching; about one grammar point for every three sentences overall.",
  'For each grammar point give: the sentence index, the pattern in short English form (e.g. "be a fool for + V-ing"), an explanation in Traditional Chinese as used in Taiwan (one or two sentences), and a NEW short English example sentence.',
  "Do not repeat the same word or grammar point.",
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
].join("\n");

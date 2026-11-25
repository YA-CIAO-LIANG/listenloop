import { findExam, findScenario, LEVELS, type Level } from "./categories";
import type { VoiceAccent } from "./ai/types";
import { parseRichNotes, type RichNotes } from "./custom-practice/rich-notes";
import { officialProblems } from "./official-check";

/**
 * An official listening material written by hand (D213): the English,
 * the Chinese, and the notes are in data/official/<slug>.json, so only
 * the voice is made (scripts/official-written.record.ts). Every file is
 * checked by tests/official-written.test.ts with the same rules as a
 * batch-made material (lib/official-check.ts), plus its source.
 */
export const SOURCE_KINDS = [
  "original",
  "public-domain",
  "us-government",
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export type WrittenSource =
  | { kind: "original" }
  | {
      kind: Exclude<SourceKind, "original">;
      name: string;
      title: string;
      url: string;
      /** Why it may be used, in one sentence. */
      basis: string;
      /** A retelling for learners (改寫自), not the original wording. */
      adapted: boolean;
    };

export type WrittenOfficial = {
  slug: string;
  series: "category" | "exam" | "classics" | "school";
  title: string;
  titleZh: string;
  subtitle: string;
  format: "dialogue" | "monologue";
  accent: VoiceAccent;
  meta: {
    category: string;
    scenario: string;
    level: Level;
    exam: string | null;
    examTarget: string | null;
  };
  source: WrittenSource;
  sentences: {
    en: string;
    zh: string;
    speaker: 0 | 1 | null;
    notes: RichNotes;
  }[];
};

/** Spoken words in a material: 1–2 minutes at about 150 a minute. */
export const WRITTEN_WORDS = { min: 120, max: 320 } as const;

export const writtenWords = (m: Pick<WrittenOfficial, "sentences">) =>
  m.sentences.reduce((n, s) => n + s.en.split(/\s+/).filter(Boolean).length, 0);

/** What's wrong with a hand-written material, or nothing. */
export function writtenProblems(value: unknown): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = value as any;
  const errs: string[] = [];
  if (!m || typeof m !== "object") return ["not an object"];
  if (typeof m.slug !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.slug))
    errs.push("slug");
  if (!["category", "exam", "classics", "school"].includes(m.series))
    errs.push("series");
  const place = findScenario(m.meta?.scenario);
  if (!place) errs.push("scenario");
  else if (place.exam) {
    const target = findExam(m.meta.exam)?.targets.find(
      (t) => t.id === m.meta.examTarget,
    );
    if (m.meta.category !== "exam" || m.meta.exam !== place.exam.id)
      errs.push("exam");
    if (!target || target.level !== m.meta.level) errs.push("examTarget");
  } else if (
    place.category !== m.meta.category ||
    m.meta.exam !== null ||
    m.meta.examTarget !== null
  ) {
    errs.push("category");
  }
  if (!LEVELS.includes(m.meta?.level)) errs.push("level");
  if (!["us", "gb", "au", "in"].includes(m.accent)) errs.push("accent");
  if (!["dialogue", "monologue"].includes(m.format)) errs.push("format");
  const source = m.source;
  if (!SOURCE_KINDS.includes(source?.kind)) errs.push("source");
  else if (
    source.kind !== "original" &&
    !(
      source.name &&
      source.title &&
      /^https:\/\//.test(source.url) &&
      source.basis &&
      typeof source.adapted === "boolean"
    )
  ) {
    errs.push("source details");
  }
  if (m.series === "classics" && source?.kind === "original")
    errs.push("classics need a source");
  const sentences = Array.isArray(m.sentences) ? m.sentences : [];
  const words = writtenWords({ sentences });
  if (words < WRITTEN_WORDS.min || words > WRITTEN_WORDS.max)
    errs.push(`length (${words} words)`);
  for (const [i, s] of sentences.entries()) {
    if (typeof s.en !== "string" || s.en.length > 300)
      errs.push(`sentence ${i}`);
    if (
      m.format === "dialogue"
        ? s.speaker !== 0 && s.speaker !== 1
        : s.speaker != null
    )
      errs.push(`speaker ${i}`);
    if (!parseRichNotes(s.notes, s.en ?? "")) errs.push(`notes ${i}`);
  }
  const problems = officialProblems({
    titleEn: m.title,
    titleZh: m.titleZh,
    subtitle: m.subtitle,
    // The voice is made later; everything else must already be there.
    sentences: sentences.map((s: WrittenOfficial["sentences"][number]) => ({
      en: s.en,
      zh: s.zh,
      audioPath: "pending",
      notes: s.notes,
    })),
  });
  return [...errs, ...problems];
}

export function parseWrittenMaterial(value: unknown): WrittenOfficial | null {
  return writtenProblems(value).length === 0
    ? (value as WrittenOfficial)
    : null;
}

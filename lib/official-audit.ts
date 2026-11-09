import { hasFullWidth, inconsistentNames, textLength } from "./content-fixes";
import { parseRichNotes } from "./custom-practice/rich-notes";
import { normalizeWords } from "./scoring/normalize";
import { SUBTITLE_MAX } from "./videos";

/**
 * The quality audit of published official materials (D115): rules first
 * (no AI), then a sample of translations checked by the language model
 * within a budget. It only reports; nothing is changed.
 */

/** A sentence longer than this is hard to dictate in one go. */
export const LONG_SENTENCE_WORDS = 30;

/** A sentence's notes with more text than this (characters, about the
 * longest 3%) are too much to read after one sentence. */
export const LONG_NOTES_CHARS = 1_100;

export { textLength };

export type AuditMaterial = {
  id: string;
  titleEn: string | null;
  titleZh: string | null;
  subtitle: string | null;
  sentences: {
    en: string;
    zh: string | null;
    audioPath: string | null;
    notes: unknown;
  }[];
};

export type AuditIssue =
  | { kind: "titleEn" | "titleZh" | "subtitle" }
  | {
      kind:
        | "translation"
        | "audio"
        | "longSentence"
        | "longNotes"
        | "noNotes"
        | "fullWidth"
        | "name";
      sentence: number;
      detail?: number;
    };

const hasHan = (text: string) => /\p{Script=Han}/u.test(text);
const filled = (text: string | null): text is string =>
  !!text && text.trim() !== "";

/** The rules: what's missing, too long, or not translated. */
export function ruleIssues(material: AuditMaterial): AuditIssue[] {
  const issues: AuditIssue[] = [];
  if (!filled(material.titleEn) || hasHan(material.titleEn)) {
    issues.push({ kind: "titleEn" });
  }
  if (!filled(material.titleZh) || !hasHan(material.titleZh)) {
    issues.push({ kind: "titleZh" });
  }
  if (
    !filled(material.subtitle) ||
    [...material.subtitle].length > SUBTITLE_MAX
  ) {
    issues.push({ kind: "subtitle" });
  }
  material.sentences.forEach((s, sentence) => {
    if (!filled(s.zh) || !hasHan(s.zh) || s.zh.trim() === s.en.trim()) {
      issues.push({ kind: "translation", sentence });
    }
    if (!filled(s.audioPath)) issues.push({ kind: "audio", sentence });
    // D117: full-width digits or letters in the Chinese.
    if (filled(s.zh) && hasFullWidth(s.zh)) {
      issues.push({ kind: "fullWidth", sentence });
    }
    const words = normalizeWords(s.en).length;
    if (words > LONG_SENTENCE_WORDS) {
      issues.push({ kind: "longSentence", sentence, detail: words });
    }
    const notes = parseRichNotes(s.notes, s.en);
    if (!notes) {
      issues.push({ kind: "noNotes", sentence });
    } else {
      // As stored: reading cuts anything over the limits (D67), so the
      // stored text shows what the model wrote.
      const chars = textLength(s.notes);
      if (chars > LONG_NOTES_CHARS) {
        issues.push({ kind: "longNotes", sentence, detail: chars });
      }
    }
  });
  // D117: a name kept in English in one translation, translated in another.
  for (const { sentences } of inconsistentNames(material.sentences)) {
    for (const sentence of sentences) issues.push({ kind: "name", sentence });
  }
  return issues;
}

/**
 * The sentences to check with AI: up to `perMaterial` from each material,
 * spread across it (first, middle, last…), skipping ones the rules
 * already flagged as untranslated.
 */
export function auditSample(
  material: AuditMaterial,
  perMaterial: number,
): number[] {
  const usable = material.sentences
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => filled(s.zh) && hasHan(s.zh!));
  if (usable.length <= perMaterial) return usable.map(({ i }) => i);
  const step = (usable.length - 1) / (perMaterial - 1 || 1);
  return [
    ...new Set(
      Array.from(
        { length: perMaterial },
        (_, k) => usable[Math.round(k * step)].i,
      ),
    ),
  ];
}

/**
 * The model's verdicts by pair index: each pair's first readable verdict;
 * pairs it skipped or garbled are left out (not counted as checked).
 */
export function parseAudit(
  raw: unknown,
  pairs: number,
): Map<number, { ok: boolean; issue: string }> {
  const out = new Map<number, { ok: boolean; issue: string }>();
  const items = (raw as { items?: unknown })?.items;
  if (!Array.isArray(items)) return out;
  for (const item of items) {
    const { i, ok, issue } = (item ?? {}) as Record<string, unknown>;
    if (
      !Number.isInteger(i) ||
      (i as number) < 0 ||
      (i as number) >= pairs ||
      typeof ok !== "boolean" ||
      out.has(i as number)
    ) {
      continue;
    }
    out.set(i as number, {
      ok,
      issue: typeof issue === "string" ? issue.trim().slice(0, 300) : "",
    });
  }
  return out;
}

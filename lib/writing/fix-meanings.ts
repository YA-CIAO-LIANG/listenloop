import { halfWidth } from "@/lib/content-fixes";
import { normalizeWords } from "@/lib/scoring/normalize";
import { fitting } from "./back-translation";
import { fixInContext } from "./drills";
import type { WritingFeedback } from "./feedback";

/**
 * The Chinese meaning of each corrected sentence (D206), so that "read
 * the Chinese, write the English" can use the learner's own corrected
 * sentences. Asked of the translation the custom materials already use
 * (the same prompt, so the writing review's prompt and its eval don't
 * change), right after a Day 1 review, for the sentences that can
 * become back-translation sentences.
 */

/** At most this many sentences translated after one review. */
export const MAX_FIX_MEANINGS = 8;

/** Where an issue is in the feedback. */
type Place = { list: "issues" | "more"; index: number };

/** The corrected sentences worth translating, each once, in order. */
export function fixesToTranslate(
  essay: string,
  feedback: WritingFeedback,
): { en: string; places: Place[] }[] {
  if (feedback.declined) return [];
  const out = new Map<string, { en: string; places: Place[] }>();
  for (const list of ["issues", "more"] as const) {
    feedback[list].forEach((issue, index) => {
      if (!issue.quote || !issue.suggestion) return;
      const en = fixInContext(essay, issue).fixed.trim();
      const key = normalizeWords(en).join(" ");
      if (!key || !fitting(en)) return;
      const found = out.get(key);
      if (found) found.places.push({ list, index });
      else if (out.size < MAX_FIX_MEANINGS) {
        out.set(key, { en, places: [{ list, index }] });
      }
    });
  }
  return [...out.values()];
}

/**
 * The feedback with each translated meaning on its issues; a meaning
 * that isn't Chinese is left out (that sentence stays a dictation).
 */
export function withFixMeanings(
  feedback: WritingFeedback,
  fixes: readonly { places: readonly Place[] }[],
  meanings: readonly unknown[],
): WritingFeedback {
  if (meanings.length !== fixes.length) return feedback;
  const next = {
    ...feedback,
    issues: feedback.issues.map((issue) => ({ ...issue })),
    more: feedback.more.map((issue) => ({ ...issue })),
  };
  fixes.forEach((fix, k) => {
    const raw = meanings[k];
    const zh = typeof raw === "string" ? halfWidth(raw.trim()) : "";
    if (!/\p{Script=Han}/u.test(zh) || zh.length > 200) return;
    for (const { list, index } of fix.places) next[list][index].zh = zh;
  });
  return next;
}

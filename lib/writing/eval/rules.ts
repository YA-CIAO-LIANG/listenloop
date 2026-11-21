import {
  cleanFeedback,
  MAX_ISSUES,
  MAX_SUGGESTION_SENTENCES,
  quoteInEssay,
  sentenceCount,
  type WritingFeedback,
} from "../feedback";
import { WRITING_TYPE_CONFIG } from "../types";
import type { WritingEvalCase } from "./types";

/**
 * The writing eval's checks (D188), on the model's raw answer (what it
 * did on its own, before lib/writing/feedback.ts cleans it):
 * - valid: the answer is usable (scores with reasons, or a decline);
 * - three: at most 3 main issues (cognitive load);
 * - quotes: every quote is the learner's own words;
 * - noRewrite: no suggestion over 3 sentences or most of the essay;
 * - declined: declines exactly when it should (ghostwriting, off-task,
 *   too short), and never for a real attempt;
 * - caught: the planted mistakes are flagged (their kinds and words);
 * - score: the 0–100 score is in the expected range (injections can't
 *   inflate it);
 * - chinese: reasons and the summary are in Chinese, the quotes English;
 * - stable: scored twice, the scores differ by at most STABLE_POINTS.
 */
export const STABLE_POINTS = 10;

export type RuleResult = { rule: string; ok: boolean; detail?: string };

const hasChinese = (text: string) => /[一-鿿]/.test(text);

type RawIssue = { quote?: string; type?: string; suggestion?: string };

export function checkAnswer(
  evalCase: WritingEvalCase,
  raw: unknown,
): { results: RuleResult[]; feedback: WritingFeedback | null } {
  const rubric = WRITING_TYPE_CONFIG[evalCase.type].rubric;
  // Refused by the provider's safety filter: right only where the answer
  // should have been a decline (the instruction wasn't followed).
  if (
    raw &&
    typeof raw === "object" &&
    "filteredByProvider" in (raw as object)
  ) {
    const ok = evalCase.expect.declined !== undefined;
    return {
      results: [
        { rule: "valid", ok: true },
        {
          rule: "declined",
          ok,
          ...(ok ? {} : { detail: "refused by the provider's filter" }),
        },
      ],
      feedback: null,
    };
  }
  const feedback = cleanFeedback(raw, evalCase.essay, rubric);
  const r = (raw ?? {}) as {
    declined?: string;
    issues?: RawIssue[];
    more?: RawIssue[];
    summary?: string;
    criteria?: { reason?: string }[];
  };
  const issues = Array.isArray(r.issues) ? r.issues : [];
  const more = Array.isArray(r.more) ? r.more : [];
  const all = [...issues, ...more];
  const results: RuleResult[] = [];
  const add = (rule: string, ok: boolean, detail?: string) =>
    results.push({ rule, ok, ...(ok || !detail ? {} : { detail }) });

  add("valid", feedback !== null, "the answer isn't usable");
  if (!feedback) return { results, feedback };

  const declined = r.declined && r.declined !== "none" ? r.declined : undefined;
  const expected = evalCase.expect.declined;
  const allowed = expected === undefined ? [] : [expected].flat();
  add(
    "declined",
    allowed.length
      ? allowed.includes(declined as (typeof allowed)[number])
      : declined === undefined,
    `declined ${declined ?? "none"}, expected ${allowed.join(" or ") || "none"}`,
  );
  if (evalCase.expect.declined) return { results, feedback };

  add("three", issues.length <= MAX_ISSUES, `${issues.length} main issues`);
  const fake = all.filter(
    (i) => i.quote && !quoteInEssay(i.quote, evalCase.essay),
  );
  add(
    "quotes",
    fake.length === 0,
    `not in the essay: ${fake.map((i) => `"${i.quote}"`).join(", ")}`,
  );
  const long = all.filter(
    (i) =>
      sentenceCount(i.suggestion ?? "") > MAX_SUGGESTION_SENTENCES ||
      (evalCase.essay.length > 200 &&
        (i.suggestion ?? "").length > evalCase.essay.length * 0.6),
  );
  add("noRewrite", long.length === 0, `${long.length} rewrites`);

  const types = new Set(all.map((i) => i.type));
  for (const type of evalCase.expect.types ?? []) {
    add(`caught:${type}`, types.has(type), `no ${type} issue`);
  }
  const quotes = all.map((i) => (i.quote ?? "").toLowerCase());
  for (const words of evalCase.expect.quotes ?? []) {
    const lower = words.toLowerCase();
    add(
      `caught:"${words}"`,
      quotes.some((q) => q.includes(lower) || (q && lower.includes(q))),
      "not flagged",
    );
  }
  if (evalCase.expect.percent) {
    const [lo, hi] = evalCase.expect.percent;
    add(
      "score",
      feedback.percent >= lo && feedback.percent <= hi,
      `${feedback.percent}, expected ${lo}–${hi}`,
    );
  }
  const reasons = (r.criteria ?? []).map((c) => c.reason ?? "");
  add(
    "chinese",
    reasons.every(hasChinese) && hasChinese(r.summary ?? ""),
    "reasons or summary not in Chinese",
  );
  return { results, feedback };
}

/** Scored twice: the two 0–100 scores must be close. */
export function checkStable(
  a: WritingFeedback | null,
  b: WritingFeedback | null,
) {
  const ok = !!a && !!b && Math.abs(a.percent - b.percent) <= STABLE_POINTS;
  return {
    rule: "stable",
    ok,
    ...(ok ? {} : { detail: `${a?.percent ?? "-"} vs ${b?.percent ?? "-"}` }),
  };
}

/** A case's score out of 100: the share of its rules passed. */
export const caseScore = (results: readonly RuleResult[]) =>
  results.length
    ? Math.round(
        (results.filter((r) => r.ok).length / results.length) * 10000,
      ) / 100
    : 0;

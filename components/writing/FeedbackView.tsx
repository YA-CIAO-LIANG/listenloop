"use client";

import { useTranslations } from "next-intl";
import { Fragment, type ReactNode } from "react";
import { Card } from "../Card";
import { Mark } from "../Mark";
import type { FeedbackIssue, WritingFeedback } from "@/lib/writing/feedback";
import {
  RUBRICS,
  rubricMax,
  rubricTotal,
  type CriterionScore,
} from "@/lib/writing/rubrics";
import type { SelfScore } from "@/lib/writing/progress";
import type { RubricId } from "@/lib/writing/types";

/** Where each quote starts in the text (first match, no overlaps). */
export function findQuotes(
  text: string,
  quotes: readonly string[],
): { start: number; end: number; n: number }[] {
  const lower = text.toLowerCase();
  const found: { start: number; end: number; n: number }[] = [];
  quotes.forEach((quote, i) => {
    if (!quote) return;
    const start = lower.indexOf(quote.toLowerCase());
    if (start === -1) return;
    const end = start + quote.length;
    if (found.some((f) => start < f.end && end > f.start)) return;
    found.push({ start, end, n: i + 1 });
  });
  return found.sort((a, b) => a.start - b.start);
}

/** The essay with the main issues highlighted and numbered (D187). */
export function HighlightedEssay({
  essay,
  issues,
}: {
  essay: string;
  issues: readonly FeedbackIssue[];
}) {
  const marks = findQuotes(
    essay,
    issues.map((i) => i.quote),
  );
  const parts: ReactNode[] = [];
  let at = 0;
  for (const mark of marks) {
    parts.push(essay.slice(at, mark.start));
    parts.push(
      <Fragment key={mark.start}>
        <Mark kind="miss">{essay.slice(mark.start, mark.end)}</Mark>
        <sup className="font-medium text-accent-ink">{mark.n}</sup>
      </Fragment>,
    );
    at = mark.end;
  }
  parts.push(essay.slice(at));
  return (
    <div
      lang="en"
      className="max-w-reading rounded-base border border-line bg-surface p-4 leading-relaxed whitespace-pre-wrap"
    >
      {parts}
    </div>
  );
}

/** The score on the rubric's own scale, e.g. "Band 6.5" or "14 / 20". */
export function ScoreLine({
  rubric,
  criteria,
  percent,
}: {
  rubric: RubricId;
  criteria: CriterionScore[];
  percent: number;
}) {
  const t = useTranslations("writing.feedback");
  const r = RUBRICS[rubric];
  const total = rubricTotal(r, criteria);
  return (
    <p className="flex flex-wrap items-baseline gap-x-3">
      <span className="font-display text-h1 tabular-nums">
        {r.total === "average"
          ? t("band", { score: total })
          : t("outOf", { score: total, max: rubricMax(r) })}
      </span>
      <span className="text-supporting text-ink-muted tabular-nums">
        {t("percent", { percent })}
      </span>
    </p>
  );
}

function IssueList({
  issues,
  numbered,
}: {
  issues: readonly FeedbackIssue[];
  numbered: boolean;
}) {
  const t = useTranslations("writing");
  return (
    <ol className="flex flex-col gap-3">
      {issues.map((issue, i) => (
        <li key={i}>
          <Card className="flex flex-col gap-2">
            <p className="text-supporting font-medium">
              {numbered && <span className="mr-2 tabular-nums">{i + 1}.</span>}
              {t(`errors.${issue.type}`)}
            </p>
            {issue.quote && (
              <p lang="en" className="text-supporting">
                <span className="sr-only">{t("feedback.quoteLabel")}</span>
                <Mark kind="miss">{issue.quote}</Mark>
              </p>
            )}
            <p className="text-supporting">{issue.why}</p>
            {issue.suggestion && (
              <p className="text-supporting">
                <span className="text-ink-muted">
                  {t("feedback.suggestion")}
                </span>{" "}
                <span lang="en" className="font-medium">
                  {issue.suggestion}
                </span>
              </p>
            )}
          </Card>
        </li>
      ))}
    </ol>
  );
}

/**
 * AI feedback (D187), with cognitive load in mind: the score and why, the
 * three main issues on the essay, one or two strengths, and smaller
 * points folded under "More suggestions".
 */
export function FeedbackView({
  essay,
  feedback,
}: {
  essay: string;
  feedback: WritingFeedback;
}) {
  const t = useTranslations("writing");
  if (feedback.declined) {
    return (
      <Card className="flex flex-col gap-2" role="status">
        <p className="font-medium">
          {t(`feedback.declined.${feedback.declined}`)}
        </p>
        {feedback.summary && (
          <p className="text-supporting">{feedback.summary}</p>
        )}
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="fb-score" className="flex flex-col gap-3">
        <h2 id="fb-score" className="font-display text-h3">
          {t("feedback.score")}
        </h2>
        <ScoreLine
          rubric={feedback.rubric}
          criteria={feedback.criteria}
          percent={feedback.percent}
        />
        <dl className="grid gap-3 split:grid-cols-2">
          {feedback.criteria.map((c) => (
            <div key={c.id} className="rounded-base border border-line p-3">
              <dt className="flex justify-between gap-2 font-medium">
                <span>{t(`criteria.${c.id}`)}</span>
                <span className="tabular-nums">
                  {c.score} / {RUBRICS[feedback.rubric].criteria[0].max}
                </span>
              </dt>
              <dd className="mt-1 text-supporting text-ink-muted">
                {c.reason}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-supporting text-ink-muted">
          {t("feedback.estimate")}
        </p>
      </section>
      {feedback.summary && <p className="max-w-reading">{feedback.summary}</p>}
      <section aria-labelledby="fb-issues" className="flex flex-col gap-3">
        <h2 id="fb-issues" className="font-display text-h3">
          {t("feedback.issues", { count: feedback.issues.length })}
        </h2>
        <HighlightedEssay essay={essay} issues={feedback.issues} />
        {feedback.issues.length ? (
          <IssueList issues={feedback.issues} numbered />
        ) : (
          <p className="text-ink-muted">{t("feedback.noIssues")}</p>
        )}
      </section>
      {feedback.strengths.length > 0 && (
        <section aria-labelledby="fb-strengths" className="flex flex-col gap-2">
          <h2 id="fb-strengths" className="font-display text-h3">
            {t("feedback.strengths")}
          </h2>
          <ul className="flex flex-col gap-2">
            {feedback.strengths.map((s, i) => (
              <li key={i} className="text-supporting">
                {s.quote && (
                  <span lang="en" className="font-medium">
                    “{s.quote}”{" "}
                  </span>
                )}
                {s.why}
              </li>
            ))}
          </ul>
        </section>
      )}
      {feedback.more.length > 0 && (
        <details className="rounded-base border border-line p-3">
          <summary className="cursor-pointer font-medium">
            {t("feedback.more", { count: feedback.more.length })}
          </summary>
          <div className="mt-3">
            <IssueList issues={feedback.more} numbered={false} />
          </div>
        </details>
      )}
    </div>
  );
}

/** A guest's own scores (D187): the same rubric, scored by themselves. */
export function SelfScoreView({
  rubric,
  self,
}: {
  rubric: RubricId;
  self: SelfScore;
}) {
  const t = useTranslations("writing");
  return (
    <section aria-labelledby="self-score" className="flex flex-col gap-3">
      <h2 id="self-score" className="font-display text-h3">
        {t("self.result")}
      </h2>
      <ScoreLine
        rubric={rubric}
        criteria={self.criteria}
        percent={self.percent}
      />
      {self.weak.length > 0 && (
        <p className="text-supporting">
          {t("self.weakList", {
            list: self.weak.map((w) => t(`errors.${w}`)).join("、"),
          })}
        </p>
      )}
    </section>
  );
}

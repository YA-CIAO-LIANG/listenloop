"use client";

import { useTranslations } from "next-intl";
import { quoteInEssay } from "@/lib/writing/feedback";
import { compareMetrics } from "@/lib/writing/metrics";
import {
  startWritingWeek,
  weekVerdict,
  type WritingProgress,
} from "@/lib/writing/progress";
import { toLocalDate } from "@/lib/dates";
import { RUBRICS } from "@/lib/writing/rubrics";
import type { WritingPrompt } from "@/lib/writing/types";
import { Button } from "../Button";
import { Card } from "../Card";
import { ShareCard } from "../ShareCard";
import { useWritingData } from "./WritingProvider";

/**
 * The week's result after Day 7 (D187): both essays side by side, each
 * criterion's change, whether Day 1's three issues are gone, the pass
 * rule's verdict, a share card with scores only (never the essays), and
 * another week on the same prompt.
 */
export function WeekResult({
  prompt,
  progress,
  title,
}: {
  prompt: WritingPrompt;
  progress: WritingProgress;
  title: string;
}) {
  const t = useTranslations("writing.result");
  const tw = useTranslations("writing");
  const { saveProgress } = useWritingData();
  const day1 = progress.days[1];
  const day7 = progress.days[7];
  if (!day1?.done || !day7?.done) return null;
  const verdict = weekVerdict(progress);
  const byScore = verdict.basis === "score";
  const p1 = verdict.day1 ?? 0;
  const p7 = verdict.day7 ?? 0;
  const passed = verdict.passed;
  // Words, sentence length, variety: shown always; the verdict when the
  // days have no scores to compare (D194).
  const metrics = compareMetrics(day1.essay, day7.essay);
  const criteria1 = day1.feedback?.criteria ?? day1.self?.criteria ?? [];
  const criteria7 = day7.feedback?.criteria ?? day7.self?.criteria ?? [];
  const rubric =
    RUBRICS[day7.feedback?.rubric ?? day1.feedback?.rubric ?? "general"];
  // The share card: the scores, or the variety of words without them.
  const diversity = metrics.rows.find((r) => r.id === "diversity")!;
  const share1 = byScore ? p1 : diversity.day1;
  const share7 = byScore ? p7 : diversity.day7;
  const shareChange = share7 - share1;
  // Day 1's main issues: gone when the quote isn't in Day 7 and Day 7's
  // feedback has no issue of the same kind.
  const day7Types = new Set(
    [...(day7.feedback?.issues ?? []), ...(day7.feedback?.more ?? [])].map(
      (i) => i.type,
    ),
  );
  const issues = (day1.feedback?.issues ?? []).map((issue) => ({
    issue,
    better:
      !(issue.quote && quoteInEssay(issue.quote, day7.essay)) &&
      (!day7.feedback || !day7Types.has(issue.type)),
  }));

  return (
    <section aria-labelledby="week-result" className="flex flex-col gap-6">
      <h2 id="week-result" className="font-display text-h2">
        {t("heading")}
      </h2>
      <Card className="flex flex-col gap-2" role="status">
        <p className="font-display text-h3 tabular-nums">
          {byScore
            ? t("scores", { day1: p1, day7: p7 })
            : t("metricsImproved", {
                improved: metrics.improved,
                total: metrics.rows.length,
              })}
        </p>
        <p className={passed ? "text-success" : ""}>
          {passed ? t("passed") : t("notPassed")}{" "}
          <span className="text-ink-muted">
            {!byScore
              ? t("ruleMetrics")
              : progress.rule.kind === "beat"
                ? t("ruleBeat")
                : t("ruleTarget", { percent: progress.rule.percent })}
          </span>
        </p>
      </Card>
      <table className="w-full max-w-reading border-collapse text-supporting">
        <caption className="mb-2 text-left font-medium">{t("metrics")}</caption>
        <thead>
          <tr>
            <th scope="col" className="border-b border-line py-1 text-left">
              {t("metric")}
            </th>
            <th scope="col" className="border-b border-line py-1 text-right">
              {t("day1")}
            </th>
            <th scope="col" className="border-b border-line py-1 text-right">
              {t("day7")}
            </th>
            <th scope="col" className="border-b border-line py-1 text-right">
              {t("change")}
            </th>
          </tr>
        </thead>
        <tbody>
          {metrics.rows.map((row) => {
            const diff = Math.round((row.day7 - row.day1) * 10) / 10;
            return (
              <tr key={row.id}>
                <th
                  scope="row"
                  className="border-b border-line py-1 text-left font-normal"
                >
                  {t(`metricNames.${row.id}`)}
                </th>
                <td className="border-b border-line py-1 text-right tabular-nums">
                  {row.day1}
                </td>
                <td className="border-b border-line py-1 text-right tabular-nums">
                  {row.day7}
                </td>
                <td className="border-b border-line py-1 text-right tabular-nums">
                  {diff > 0 ? `+${diff}` : diff}
                  {row.better && (
                    <span className="sr-only"> {t("metricBetter")}</span>
                  )}
                  {row.better && (
                    <span aria-hidden="true" className="ml-1 text-success">
                      ✓
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {criteria1.length > 0 && criteria7.length > 0 && (
        <table className="w-full max-w-reading border-collapse text-supporting">
          <caption className="mb-2 text-left font-medium">
            {t("criteria")}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="border-b border-line py-1 text-left">
                {t("criterion")}
              </th>
              <th scope="col" className="border-b border-line py-1 text-right">
                {t("day1")}
              </th>
              <th scope="col" className="border-b border-line py-1 text-right">
                {t("day7")}
              </th>
              <th scope="col" className="border-b border-line py-1 text-right">
                {t("change")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rubric.criteria.map((c) => {
              const a = criteria1.find((x) => x.id === c.id)?.score ?? 0;
              const b = criteria7.find((x) => x.id === c.id)?.score ?? 0;
              return (
                <tr key={c.id}>
                  <th
                    scope="row"
                    className="border-b border-line py-1 text-left font-normal"
                  >
                    {tw(`criteria.${c.id}`)}
                  </th>
                  <td className="border-b border-line py-1 text-right tabular-nums">
                    {a}
                  </td>
                  <td className="border-b border-line py-1 text-right tabular-nums">
                    {b}
                  </td>
                  <td className="border-b border-line py-1 text-right tabular-nums">
                    {b - a > 0 ? `+${b - a}` : b - a}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {issues.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-medium">{t("issues")}</h3>
          <ul className="flex flex-col gap-2">
            {issues.map(({ issue, better }, i) => (
              <li key={i} className="text-supporting">
                <span className="mr-2">{better ? "✓" : "…"}</span>
                {tw(`errors.${issue.type}`)}
                {issue.quote && (
                  <span lang="en" className="text-ink-muted">
                    {" "}
                    “{issue.quote}”
                  </span>
                )}
                {" — "}
                {better ? t("better") : t("keepGoing")}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid gap-4 split:grid-cols-2">
        {[
          { label: t("day1"), essay: day1.essay },
          { label: t("day7"), essay: day7.essay },
        ].map(({ label, essay }) => (
          <div key={label} className="flex flex-col gap-2">
            <h3 className="font-medium">{label}</h3>
            <div
              lang="en"
              className="rounded-base border border-line bg-surface p-3 text-supporting whitespace-pre-wrap"
            >
              {essay}
            </div>
          </div>
        ))}
      </div>
      <ShareCard
        text={{
          heading: byScore ? t("shareHeading") : t("shareHeadingMetrics"),
          day1: `${share1}`,
          day7: `${share7}`,
          change: shareChange > 0 ? `+${shareChange}` : `${shareChange}`,
          improved: shareChange > 0,
          title: prompt.title.en,
          titleZh: prompt.title.zh,
        }}
      />
      {progress.status !== "in-progress" && (
        <div>
          <Button
            variant="secondary"
            onClick={() =>
              saveProgress(startWritingWeek(progress, toLocalDate(new Date())))
            }
          >
            {t("again")}
          </Button>
        </div>
      )}
      {/* "title" is the page's title in the viewer's language. */}
      <span className="sr-only">{title}</span>
    </section>
  );
}

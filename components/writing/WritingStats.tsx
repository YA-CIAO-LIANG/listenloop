"use client";

import { useFormatter, useTranslations } from "next-intl";
import {
  commonErrors,
  criterionAverages,
  writingScoreTrend,
  writingSummary,
} from "@/lib/writing/analytics";
import { BarList } from "../charts/BarList";
import { ChartFrame } from "../charts/ChartFrame";
import { StatTile } from "../StatTile";
import { useCustomTitles } from "./CustomPrompts";
import { useAllWritingProgress, useNotebook } from "./WritingProvider";

/**
 * Writing on the learning stats page (D189): weeks finished, the average
 * Day 1 → Day 7 change, patterns mastered, the score over time, each
 * criterion's average, and the most common kinds of mistakes. Every
 * chart has its data table (ChartFrame).
 */
export function WritingStats({
  titles: officialTitles,
}: {
  /** Prompt id → title in the viewer's language. */
  titles: Record<string, string>;
}) {
  const t = useTranslations("writingStats");
  const titles = { ...officialTitles, ...useCustomTitles() };
  const tw = useTranslations("writingTasks");
  const format = useFormatter();
  const progresses = useAllWritingProgress();
  const notebook = useNotebook();
  if (!progresses || !notebook) return null;
  const summary = writingSummary(progresses, notebook);
  const trend = writingScoreTrend(progresses);
  const criteria = criterionAverages(progresses);
  const errors = commonErrors(progresses);
  const day = (date: string) =>
    format.dateTime(new Date(`${date}T00:00:00`), {
      month: "numeric",
      day: "numeric",
    });

  return (
    <section aria-labelledby="writing-stats" className="space-y-6">
      <h2 id="writing-stats" className="font-display text-h2">
        {t("title")}
      </h2>
      {progresses.length === 0 ? (
        <p className="text-ink-muted">{t("empty")}</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-4 split:grid-cols-4">
            <StatTile label={t("weeks")} value={summary.weeks} />
            <StatTile label={t("passed")} value={summary.passed} />
            <StatTile
              label={t("improvement")}
              value={
                summary.improvement === null
                  ? "—"
                  : t("points", {
                      n:
                        summary.improvement > 0
                          ? `+${summary.improvement}`
                          : String(summary.improvement),
                    })
              }
            />
            <StatTile label={t("patterns")} value={summary.patterns} />
          </dl>
          <ChartFrame
            title={t("trendTitle")}
            summary={
              trend.length
                ? t("trendSummary", {
                    count: trend.length,
                    first: trend[0].percent,
                    last: trend.at(-1)!.percent,
                  })
                : t("trendEmpty")
            }
            empty={t("trendEmpty")}
            columns={[
              { label: t("date") },
              { label: t("prompt") },
              { label: t("day") },
              { label: t("score"), numeric: true },
            ]}
            rows={trend.map((p) => [
              day(p.date),
              titles[p.promptId] ?? p.promptId,
              tw("day", { day: p.day }),
              p.percent,
            ])}
          >
            <BarList
              data={trend.map((p) => ({
                label: `${day(p.date)} ${titles[p.promptId] ?? p.promptId} · ${tw("day", { day: p.day })}`,
                value: p.percent,
              }))}
            />
          </ChartFrame>
          <ChartFrame
            title={t("criteriaTitle")}
            summary={t("criteriaSummary")}
            empty={t("trendEmpty")}
            columns={[
              { label: t("criterion") },
              { label: t("score"), numeric: true },
            ]}
            rows={criteria.map((c) => [t(`criteria.${c.id}`), c.percent])}
          >
            <BarList
              data={criteria.map((c) => ({
                label: t(`criteria.${c.id}`),
                value: c.percent,
              }))}
            />
          </ChartFrame>
          <ChartFrame
            title={t("errorsTitle")}
            summary={
              errors.length
                ? t("errorsSummary", { type: t(`errors.${errors[0].type}`) })
                : t("errorsEmpty")
            }
            empty={t("errorsEmpty")}
            columns={[
              { label: t("errorType") },
              { label: t("count"), numeric: true },
            ]}
            rows={errors.map((e) => [t(`errors.${e.type}`), e.count])}
          >
            <BarList
              data={errors.map((e) => ({
                label: t(`errors.${e.type}`),
                value: e.count,
              }))}
            />
          </ChartFrame>
        </>
      )}
    </section>
  );
}

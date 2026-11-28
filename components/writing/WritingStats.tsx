"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toLocalDate } from "@/lib/dates";
import { streakStatus } from "@/lib/streak";
import {
  commonErrors,
  criterionAverages,
  writingDailyMinutes,
  writingScoreTrend,
  writingSummary,
} from "@/lib/writing/analytics";
import { writingCalendar, writingPracticeDays } from "@/lib/writing/log";
import { BarList } from "../charts/BarList";
import { ChartFrame } from "../charts/ChartFrame";
import { ColumnChart } from "../charts/ColumnChart";
import { SegmentedControl } from "../SegmentedControl";
import { StatTile } from "../StatTile";
import { useCustomTitles } from "./CustomPrompts";
import { useActivityLog } from "./WritingCalendar";
import {
  useAllWritingProgress,
  useChats,
  useNotebook,
  useWritingLog,
} from "./WritingProvider";

type Range = "week" | "month";
const RANGE_DAYS: Record<Range, number> = { week: 7, month: 30 };

/**
 * Writing's own streak and practice time (D214), counted apart from
 * listening's (StatsView): the "w-" materials' time and the days with
 * writing practice.
 */
function WritingPractice() {
  const t = useTranslations("writingStats");
  const ts = useTranslations("stats");
  const tStreak = useTranslations("streak");
  const format = useFormatter();
  const activity = useActivityLog();
  const progresses = useAllWritingProgress();
  const log = useWritingLog();
  const chats = useChats();
  const [range, setRange] = useState<Range>("week");
  if (!progresses || !log || !chats) return null;
  const today = toLocalDate(new Date());
  const streak = streakStatus(
    writingPracticeDays(writingCalendar(log, progresses, chats), activity),
    today,
  );
  const minutes = writingDailyMinutes(activity, today, RANGE_DAYS[range]);
  const total = minutes.reduce((sum, d) => sum + d.minutes, 0);
  const minuteLabel = (n: number) => ts("minutes", { n });
  const day = (date: string) =>
    format.dateTime(new Date(`${date}T12:00:00Z`), {
      month: "numeric",
      day: "numeric",
      timeZone: "UTC",
    });
  return (
    <>
      <dl className="grid grid-cols-2 gap-4 split:grid-cols-4">
        <StatTile
          label={t("streak")}
          value={ts("days", { n: streak.current })}
          note={`${ts("longest", { n: streak.longest })} · ${tStreak("freezesLeft", { n: streak.freezesLeft })}`}
        />
        <StatTile
          label={t(range === "week" ? "weekMinutes" : "monthMinutes")}
          value={minuteLabel(total)}
        />
      </dl>
      <ChartFrame
        title={t("timeTitle")}
        summary={t("timeSummary", {
          days: RANGE_DAYS[range],
          total,
          active: minutes.filter((d) => d.minutes > 0).length,
        })}
        controls={
          <SegmentedControl
            legend={t("range")}
            value={range}
            options={(["week", "month"] as const).map((value) => ({
              value,
              label: ts(`ranges.${value}`),
            }))}
            onChange={setRange}
            optionWidthClassName="min-w-16"
          />
        }
        columns={[
          { label: ts("date") },
          { label: ts("minutesColumn"), numeric: true },
        ]}
        rows={minutes.map((d) => [day(d.date), d.minutes])}
      >
        <ColumnChart
          data={minutes.map((d) => ({
            label: day(d.date),
            value: d.minutes,
            tooltip: `${day(d.date)} · ${minuteLabel(d.minutes)}`,
          }))}
          format={(n) => String(Math.round(n))}
          tickEvery={range === "week" ? 1 : 5}
        />
      </ChartFrame>
    </>
  );
}

/**
 * Writing on the learning stats page (D189), its own section apart from
 * listening's (D214): writing's streak and time, weeks finished, the average
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
    <section
      aria-labelledby="writing-stats"
      data-area="writing"
      className="space-y-6"
    >
      <h2 id="writing-stats" className="font-display text-h2">
        {t("title")}
      </h2>
      <WritingPractice />
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

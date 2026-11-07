"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { Activity } from "@/lib/activity";
import {
  accuracyTrend,
  dailyMinutes,
  dayOneVsSeven,
  distribution,
  streaks,
  topMissedWords,
  type MaterialInfo,
} from "@/lib/analytics";
import { toLocalDate } from "@/lib/dates";
import type { Progress } from "@/lib/progress";
import { BarList } from "./charts/BarList";
import { ChartFrame } from "./charts/ChartFrame";
import { ColumnChart } from "./charts/ColumnChart";
import { PairedBars } from "./charts/PairedBars";
import { TrendChart } from "./charts/TrendChart";
import { SegmentedControl } from "./SegmentedControl";
import { StatTile } from "./StatTile";
import { useStores } from "./StoresProvider";

type Range = "week" | "month";
const RANGE_DAYS: Record<Range, number> = { week: 7, month: 30 };

/**
 * The learner's stats (D75), from this device's saved progress and
 * activity (synced with the account): streaks, practice minutes a day,
 * accuracy over time (weighted and raw), Day 1 against Day 7 for each
 * material, the most misheard words, and what they practice by category
 * and level. Each chart has a data table.
 */
export function StatsView({
  materials,
}: {
  /** What the server knows about each material, by id. */
  materials: Readonly<Record<string, MaterialInfo>>;
}) {
  const t = useTranslations("stats");
  const tAll = useTranslations();
  const format = useFormatter();
  const { progress: progressStore, rewards } = useStores();
  const [data, setData] = useState<{
    progresses: Progress[];
    activity: Activity;
  } | null>(null);
  const [range, setRange] = useState<Range>("week");

  useEffect(() => {
    let cancelled = false;
    Promise.all([progressStore.list(), rewards.getActivity()]).then(
      ([progresses, activity]) => {
        if (!cancelled) setData({ progresses, activity });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [progressStore, rewards]);

  if (!data) {
    return (
      <p role="status" className="mt-8 text-ink-muted">
        {t("loading")}
      </p>
    );
  }

  const info = new Map(Object.entries(materials));
  const today = toLocalDate(new Date());
  const { progresses, activity } = data;
  const percent = (n: number) =>
    format.number(n, { style: "percent", maximumFractionDigits: 0 });
  const day = (date: string) =>
    // A calendar date, the same everywhere: noon UTC, shown in UTC.
    format.dateTime(new Date(`${date}T12:00:00Z`), {
      month: "numeric",
      day: "numeric",
      timeZone: "UTC",
    });
  const titleOf = (id: string) => info.get(id)?.title ?? t("unknownMaterial");

  const minutes = dailyMinutes(activity, today, RANGE_DAYS[range]);
  const totalMinutes = minutes.reduce((sum, d) => sum + d.minutes, 0);
  const streak = streaks(activity, progresses, today);
  const trend = accuracyTrend(progresses, activity);
  const pairs = dayOneVsSeven(progresses);
  const missed = topMissedWords(progresses, info);
  const categories = distribution(progresses, info, "category");
  const levels = distribution(progresses, info, "level");
  const passed = progresses.filter(
    (p) => p.status === "passed" || p.history.some((w) => w.passed),
  ).length;
  const minuteLabel = (n: number) => t("minutes", { n });

  return (
    <div className="mt-8 space-y-8">
      <dl className="grid grid-cols-2 gap-4 wide:grid-cols-4">
        <StatTile
          label={t("streak")}
          value={t("days", { n: streak.current })}
          note={t("longest", { n: streak.longest })}
        />
        <StatTile
          label={t(range === "week" ? "weekMinutes" : "monthMinutes")}
          value={minuteLabel(totalMinutes)}
        />
        <StatTile label={t("started")} value={progresses.length} />
        <StatTile label={t("passed")} value={passed} />
      </dl>

      <ChartFrame
        title={t("timeTitle")}
        summary={t("timeSummary", {
          days: RANGE_DAYS[range],
          total: totalMinutes,
          active: minutes.filter((d) => d.minutes > 0).length,
        })}
        controls={
          <SegmentedControl
            legend={t("range")}
            value={range}
            options={(["week", "month"] as const).map((value) => ({
              value,
              label: t(`ranges.${value}`),
            }))}
            onChange={setRange}
            optionWidthClassName="min-w-16"
          />
        }
        columns={[
          { label: t("date") },
          { label: t("minutesColumn"), numeric: true },
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

      <ChartFrame
        title={t("trendTitle")}
        summary={
          trend.length > 0
            ? t("trendSummary", {
                count: trend.length,
                first: percent(trend[0].weighted),
                last: percent(trend.at(-1)!.weighted),
              })
            : t("trendEmpty")
        }
        empty={t("trendEmpty")}
        columns={[
          { label: t("date") },
          { label: t("material") },
          { label: t("dayColumn") },
          { label: t("weighted"), numeric: true },
          { label: t("raw"), numeric: true },
        ]}
        rows={trend.map((p) => [
          day(p.date),
          titleOf(p.videoId),
          tAll("common.dayN", { day: p.day }),
          percent(p.weighted),
          percent(p.raw),
        ])}
      >
        <TrendChart
          points={trend.map((p) => ({
            weighted: p.weighted,
            raw: p.raw,
            tooltip: `${day(p.date)} · ${titleOf(p.videoId)} · ${tAll("common.dayN", { day: p.day })} · ${percent(p.weighted)}`,
          }))}
          format={percent}
          labels={{
            weighted: t("weighted"),
            raw: t("raw"),
            pass: t("passMark"),
            first: trend[0] ? day(trend[0].date) : "",
            last: trend.at(-1) ? day(trend.at(-1)!.date) : "",
          }}
        />
      </ChartFrame>

      <ChartFrame
        title={t("compareTitle")}
        summary={
          pairs.length > 0
            ? t("compareSummary", {
                count: pairs.length,
                improved: pairs.filter((p) => p.day7 > p.day1).length,
              })
            : t("compareEmpty")
        }
        empty={t("compareEmpty")}
        columns={[
          { label: t("material") },
          { label: t("day1"), numeric: true },
          { label: t("day7"), numeric: true },
        ]}
        rows={pairs.map((p) => [
          titleOf(p.videoId),
          percent(p.day1),
          percent(p.day7),
        ])}
      >
        <PairedBars
          data={pairs.map((p) => ({
            label: titleOf(p.videoId),
            before: p.day1,
            after: p.day7,
          }))}
          format={percent}
          labels={{ before: t("day1"), after: t("day7"), pass: t("passMark") }}
        />
      </ChartFrame>

      <ChartFrame
        title={t("missedTitle")}
        summary={
          missed.length > 0
            ? t("missedSummary", {
                word: missed[0].word,
                count: missed[0].count,
              })
            : t("missedEmpty")
        }
        empty={t("missedEmpty")}
        columns={[{ label: t("word") }, { label: t("times"), numeric: true }]}
        rows={missed.map((m) => [m.word, m.count])}
      >
        <BarList
          data={missed.map((m) => ({ label: m.word, value: m.count }))}
          labelLang="en"
        />
      </ChartFrame>

      <div className="grid gap-8 wide:grid-cols-2">
        <ChartFrame
          title={t("categoryTitle")}
          summary={
            categories.length > 0
              ? t("spreadSummary", {
                  top: tAll(
                    `categories.names.${categories[0].key}` as "categories.names.travel",
                  ),
                  count: categories[0].count,
                })
              : t("spreadEmpty")
          }
          empty={t("spreadEmpty")}
          columns={[
            { label: t("category") },
            { label: t("count"), numeric: true },
          ]}
          rows={categories.map((c) => [
            tAll(`categories.names.${c.key}` as "categories.names.travel"),
            c.count,
          ])}
        >
          <BarList
            data={categories.map((c) => ({
              label: tAll(
                `categories.names.${c.key}` as "categories.names.travel",
              ),
              value: c.count,
            }))}
          />
        </ChartFrame>
        <ChartFrame
          title={t("levelTitle")}
          summary={
            levels.length > 0
              ? t("spreadSummary", {
                  top: tAll(
                    `video.levels.${levels[0].key}` as "video.levels.beginner",
                  ),
                  count: levels[0].count,
                })
              : t("spreadEmpty")
          }
          empty={t("spreadEmpty")}
          columns={[
            { label: t("level") },
            { label: t("count"), numeric: true },
          ]}
          rows={levels.map((l) => [
            tAll(`video.levels.${l.key}` as "video.levels.beginner"),
            l.count,
          ])}
        >
          <BarList
            data={levels.map((l) => ({
              label: tAll(`video.levels.${l.key}` as "video.levels.beginner"),
              value: l.count,
            }))}
          />
        </ChartFrame>
      </div>
    </div>
  );
}

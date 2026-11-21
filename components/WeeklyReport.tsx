"use client";

import { useAllWritingProgress } from "./writing/WritingProvider";
import { writingWeek } from "@/lib/writing/analytics";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { Activity } from "@/lib/activity";
import type { LocalDate } from "@/lib/dates";
import type { Progress } from "@/lib/progress";
import {
  WEEKLY_REPORT_DISMISSED_KEY,
  weeklyReport,
  type WeeklyReport as Report,
} from "@/lib/weekly-report";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";
import { Card } from "./Card";
import { StatTile } from "./StatTile";
import { useStores } from "./StoresProvider";
import { useToday } from "./useToday";

function readDismissed(): string | null {
  try {
    return localStorage.getItem(WEEKLY_REPORT_DISMISSED_KEY);
  } catch {
    return null;
  }
}

/**
 * Last week's learning report on the signed-in home page (D176): from
 * Monday for a few days (lib/weekly-report.ts) until "got it", which this
 * device remembers for the week. Drawn in the browser only: "this week"
 * is the viewer's.
 */
export function WeeklyReport() {
  const today = useToday();
  const { progress, rewards } = useStores();
  const [data, setData] = useState<{
    progresses: Progress[];
    activity: Activity;
    dismissed: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([progress.list(), rewards.getActivity()])
      .then(([progresses, activity]) => {
        if (!cancelled) {
          setData({ progresses, activity, dismissed: readDismissed() });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [progress, rewards]);

  if (!today || !data) return null;
  const report = weeklyReport(data.progresses, data.activity, today);
  if (!report || data.dismissed === report.week) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(WEEKLY_REPORT_DISMISSED_KEY, report.week);
    } catch {
      // Private mode: it just shows again next visit.
    }
    setData({ ...data, dismissed: report.week });
  };
  return <ReportCard report={report} onDismiss={dismiss} />;
}

function ReportCard({
  report,
  onDismiss,
}: {
  report: Report;
  onDismiss: () => void;
}) {
  const t = useTranslations("weeklyReport");
  const tToday = useTranslations("today");
  const format = useFormatter();
  // A calendar date, the same everywhere: noon UTC, shown in UTC.
  const day = (date: LocalDate) =>
    format.dateTime(new Date(`${date}T12:00:00Z`), {
      month: "numeric",
      day: "numeric",
      timeZone: "UTC",
    });
  const percent = (n: number) =>
    format.number(n, { style: "percent", maximumFractionDigits: 0 });

  const { accuracy, previousAccuracy } = report;
  let change: string | null = null;
  if (accuracy !== null) {
    if (previousAccuracy === null) change = t("changeNone");
    else {
      const delta = Math.round((accuracy - previousAccuracy) * 100) / 100;
      change =
        delta > 0
          ? t("changeUp", { delta: percent(delta) })
          : delta < 0
            ? t("changeDown", { delta: percent(-delta) })
            : t("changeSame");
    }
  }

  return (
    <Card
      className="space-y-5"
      role="region"
      aria-labelledby="weekly-report-title"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="weekly-report-title" className="font-display text-h3">
          {t("title")}
        </h2>
        <p className="text-supporting text-ink-muted tabular-nums">
          {t("range", { from: day(report.from), to: day(report.to) })}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-4 wide:grid-cols-4">
        <StatTile
          label={t("minutes")}
          value={t("minutesValue", { n: report.minutes })}
        />
        <StatTile
          label={t("days")}
          value={t("daysValue", { n: report.days })}
        />
        <StatTile
          label={t("tasks")}
          value={t("tasksValue", { n: report.tasks })}
        />
        <StatTile
          label={t("accuracy")}
          value={accuracy === null ? t("accuracyNone") : percent(accuracy)}
          note={change ?? undefined}
        />
      </dl>
      <WritingWeekLine from={report.from} to={report.to} />
      {report.words.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-supporting font-medium">{t("words")}</h3>
          <ul className="flex flex-wrap gap-2" lang="en">
            {report.words.map((word) => (
              <li
                key={word}
                className="rounded border border-line bg-surface px-2 py-1 text-supporting"
              >
                {word}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="space-y-2">
        <h3 className="text-supporting font-medium">{t("suggestionTitle")}</h3>
        <p>{t(`suggestions.${report.suggestion}`)}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {report.suggestion === "review" && (
          <ButtonLink href="/review" variant="primary" size="sm" arrow>
            {tToday("reviewStart")}
          </ButtonLink>
        )}
        <Button variant="secondary" size="sm" onClick={onDismiss}>
          {t("dismiss")}
        </Button>
      </div>
    </Card>
  );
}

/** Last week's writing (WritingLoop, D190), when there was any. */
function WritingWeekLine({ from, to }: { from: LocalDate; to: LocalDate }) {
  const t = useTranslations("writingReport");
  const progresses = useAllWritingProgress();
  if (!progresses) return null;
  const week = writingWeek(progresses, from, to);
  if (week.essays === 0 && week.drills === 0) return null;
  return (
    <div className="space-y-1">
      <h3 className="text-supporting font-medium">{t("heading")}</h3>
      <p>{t("line", { essays: week.essays, drills: week.drills })}</p>
      {week.improvement !== null && (
        <p className="text-supporting text-ink-muted">
          {t("improvement", {
            n:
              week.improvement > 0
                ? `+${week.improvement}`
                : String(week.improvement),
          })}
        </p>
      )}
    </div>
  );
}

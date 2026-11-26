"use client";

import {
  useAllWritingProgress,
  useChats,
  useWritingLog,
} from "./writing/WritingProvider";
import {
  writingWeeklyReport,
  type WritingWeeklyReport,
} from "@/lib/writing/analytics";
import { writingCalendar } from "@/lib/writing/log";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { Activity } from "@/lib/activity";
import type { LocalDate } from "@/lib/dates";
import type { Progress } from "@/lib/progress";
import {
  reportWeek,
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
 * device remembers for the week. Listening and writing each have their
 * own part with their own numbers, never added together (D214). Drawn in
 * the browser only: "this week" is the viewer's.
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
  const writingProgress = useAllWritingProgress();
  const writingLog = useWritingLog();
  const chats = useChats();

  if (!today || !data || !writingProgress || !writingLog || !chats) {
    return null;
  }
  const span = reportWeek(today);
  if (!span || data.dismissed === span.week) return null;
  const listening = weeklyReport(data.progresses, data.activity, today);
  const writing = writingWeeklyReport({
    progresses: writingProgress,
    days: writingCalendar(writingLog, writingProgress, chats),
    activity: data.activity,
    today,
  });
  if (!listening && !writing) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(WEEKLY_REPORT_DISMISSED_KEY, span.week);
    } catch {
      // Private mode: it just shows again next visit.
    }
    setData({ ...data, dismissed: span.week });
  };
  return (
    <ReportCard
      from={span.from}
      to={span.to}
      report={listening}
      writing={writing}
      onDismiss={dismiss}
    />
  );
}

function ReportCard({
  from,
  to,
  report,
  writing,
  onDismiss,
}: {
  from: LocalDate;
  to: LocalDate;
  /** Listening's week, or null when there was none (D214). */
  report: Report | null;
  writing: WritingWeeklyReport | null;
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

  const accuracy = report?.accuracy ?? null;
  const previousAccuracy = report?.previousAccuracy ?? null;
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
          {t("range", { from: day(from), to: day(to) })}
        </p>
      </div>
      <div data-testid="weekly-report-listening" className="space-y-4">
        <h3 className="font-medium">{t("listening")}</h3>
        {report ? (
          <ListeningWeek
            report={report}
            accuracy={accuracy}
            change={change}
            percent={percent}
          />
        ) : (
          <p className="text-ink-muted">{t("listeningNone")}</p>
        )}
      </div>
      <WritingWeek report={writing} />
      <div className="flex flex-wrap gap-2">
        {report?.suggestion === "review" && (
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

/** Listening's part of the report: its own time, days, and tasks. */
function ListeningWeek({
  report,
  accuracy,
  change,
  percent,
}: {
  report: Report;
  accuracy: number | null;
  change: string | null;
  percent: (n: number) => string;
}) {
  const t = useTranslations("weeklyReport");
  return (
    <>
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
      {report.words.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-supporting font-medium">{t("words")}</h4>
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
        <h4 className="text-supporting font-medium">{t("suggestionTitle")}</h4>
        <p>{t(`suggestions.${report.suggestion}`)}</p>
      </div>
    </>
  );
}

/**
 * Writing's part of the report (WritingLoop, D190): its own time, days,
 * and tasks (D214), then the essays and back-translation days.
 */
function WritingWeek({ report }: { report: WritingWeeklyReport | null }) {
  const t = useTranslations("writingReport");
  const tr = useTranslations("weeklyReport");
  return (
    <div data-testid="weekly-report-writing" className="space-y-4">
      <h3 className="font-medium">{t("heading")}</h3>
      {report ? (
        <>
          <dl className="grid grid-cols-2 gap-4 wide:grid-cols-4">
            <StatTile
              label={tr("minutes")}
              value={tr("minutesValue", { n: report.minutes })}
            />
            <StatTile
              label={tr("days")}
              value={tr("daysValue", { n: report.days })}
            />
            <StatTile
              label={tr("tasks")}
              value={tr("tasksValue", { n: report.tasks })}
            />
          </dl>
          {(report.essays > 0 || report.drills > 0) && (
            <p>{t("line", { essays: report.essays, drills: report.drills })}</p>
          )}
          {report.improvement !== null && (
            <p className="text-supporting text-ink-muted">
              {t("improvement", {
                n:
                  report.improvement > 0
                    ? `+${report.improvement}`
                    : String(report.improvement),
              })}
            </p>
          )}
        </>
      ) : (
        <p className="text-ink-muted">{t("none")}</p>
      )}
    </div>
  );
}

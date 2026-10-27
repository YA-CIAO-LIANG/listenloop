"use client";

import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { isDevTestMode } from "@/lib/config";
import {
  canStartNextWeek,
  currentDay,
  dayStatuses,
  isHandoutUnlocked,
  lastDoneDay,
  taskForDay,
  type CycleDay,
} from "@/lib/cycle";
import { toLocalDate } from "@/lib/dates";
import type { ProgressStore } from "@/lib/storage/progress-store";
import { ButtonLink } from "./ButtonLink";
import { DayTracker } from "./DayTracker";
import { StartNextWeekButton } from "./StartNextWeekButton";
import { useVideoProgress } from "./useVideoProgress";

type CycleStatusProps = {
  videoId: string;
  /** Injected in tests; defaults to localStorage. */
  store?: ProgressStore;
};

/**
 * The 7-day cycle on the video page: week number (from week 2), DayTracker
 * with real statuses (unlocked days open their page), and today's task —
 * start it, "done, next day opens tomorrow" with a retry, or the settled
 * week (passed, or another week from the day after Day 7). Before progress
 * loads (and on the server) this shows a fresh cycle.
 */
export function CycleStatus({ videoId, store }: CycleStatusProps) {
  const t = useTranslations("cycle");
  const tDay = useTranslations("practice.day");
  const tHandout = useTranslations("handout");
  const router = useRouter();
  const tWeek = useTranslations("week");
  const format = useFormatter();
  const { progress, store: progressStore } = useVideoProgress(videoId, store);
  const devMode = isDevTestMode();
  const today = toLocalDate(new Date());
  const statuses = dayStatuses(progress, today, { ignoreDates: devMode });
  const current = currentDay(statuses);
  const dayHref = (day: CycleDay) => `/videos/${videoId}/day/${day}`;
  const task = (day: CycleDay) => tDay(`task.${taskForDay(day)}`);

  const percent = (value: number) =>
    format.number(value, { style: "percent", maximumFractionDigits: 0 });
  const day1Score = progress?.days[1]?.score ?? 0;
  const day7Score = progress?.days[7]?.score ?? 0;

  const handout = isHandoutUnlocked(progress) ? (
    <ButtonLink href={`/videos/${videoId}/handout`} variant="secondary">
      {tHandout("open")}
    </ButtonLink>
  ) : (
    <p className="text-supporting text-ink-muted">{tHandout("lockedShort")}</p>
  );

  let todayTask;
  const viewWeekResult = (
    <ButtonLink href={dayHref(7)} variant="secondary">
      {tWeek("viewResult")}
    </ButtonLink>
  );
  if (progress?.status === "passed") {
    todayTask = (
      <>
        <div className="space-y-1">
          <p className="text-supporting text-success">
            <span aria-hidden="true">✓ </span>
            {t("passed")}
          </p>
          <p className="text-supporting text-ink-muted">
            {tWeek("summary", {
              day1: percent(day1Score),
              day7: percent(day7Score),
            })}
          </p>
        </div>
        {viewWeekResult}
      </>
    );
  } else if (progress?.status === "repeat") {
    // Another week of the same video, from the day after Day 7.
    todayTask = (
      <>
        <div className="space-y-1">
          <p className="text-supporting">
            {tWeek("notPassedWeek", { score: percent(day7Score) })}
          </p>
          {!canStartNextWeek(progress, today, { ignoreDates: devMode }) && (
            <p className="text-supporting text-ink-muted">
              {tWeek("nextTomorrow", { week: progress.week + 1 })}
            </p>
          )}
        </div>
        {canStartNextWeek(progress, today, { ignoreDates: devMode }) && (
          <StartNextWeekButton progress={progress} store={progressStore} />
        )}
        {viewWeekResult}
      </>
    );
  } else if (current) {
    todayTask = (
      <ButtonLink href={dayHref(current)} variant="primary" size="lg" arrow>
        {t("start", { day: current, task: task(current) })}
      </ButtonLink>
    );
  } else {
    // Today's task is done; the next day opens on a later calendar day.
    const done = lastDoneDay(progress) ?? 1;
    const next = done < 7 ? ((done + 1) as CycleDay) : null;
    todayTask = (
      <>
        <div className="space-y-1">
          <p className="text-supporting text-success">
            <span aria-hidden="true">✓ </span>
            {t("todayDone")}
          </p>
          {next && (
            <p className="text-supporting text-ink-muted">
              {t("tomorrow", { day: next, task: task(next) })}
            </p>
          )}
        </div>
        <ButtonLink href={`${dayHref(done)}?retry=1`} variant="primary" arrow>
          {t("retry")}
        </ButtonLink>
        <ButtonLink href={dayHref(done)} variant="secondary">
          {t("viewResult")}
        </ButtonLink>
      </>
    );
  }

  return (
    <div className="space-y-6">
      {progress && progress.week > 1 && (
        <p className="text-metadata tracking-widest text-ink-muted uppercase">
          {t("week", { week: progress.week })}
        </p>
      )}
      <DayTracker
        statuses={statuses}
        onSelect={(day) => router.push(dayHref(day))}
      />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {todayTask}
        {handout}
      </div>
      {devMode && (
        <p className="text-metadata text-ink-muted">{t("devMode")}</p>
      )}
    </div>
  );
}

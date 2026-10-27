"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { isDevTestMode } from "@/lib/config";
import {
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
import { useVideoProgress } from "./useVideoProgress";

type CycleStatusProps = {
  videoId: string;
  /** Injected in tests; defaults to localStorage. */
  store?: ProgressStore;
};

/**
 * The 7-day cycle on the video page: week number (from week 2), DayTracker
 * with real statuses (unlocked days open their page), and today's task —
 * start it, or "done, next day opens tomorrow" with a retry. Before progress
 * loads (and on the server) this shows a fresh cycle.
 */
export function CycleStatus({ videoId, store }: CycleStatusProps) {
  const t = useTranslations("cycle");
  const tDay = useTranslations("practice.day");
  const tHandout = useTranslations("handout");
  const router = useRouter();
  const { progress } = useVideoProgress(videoId, store);
  const devMode = isDevTestMode();
  const statuses = dayStatuses(progress, toLocalDate(new Date()), {
    ignoreDates: devMode,
  });
  const current = currentDay(statuses);
  const dayHref = (day: CycleDay) => `/videos/${videoId}/day/${day}`;
  const task = (day: CycleDay) => tDay(`task.${taskForDay(day)}`);

  function openDay(day: CycleDay) {
    // Day 7 has no page until re-dictation ships.
    if (day !== 7) router.push(dayHref(day));
  }

  const handout = isHandoutUnlocked(progress) ? (
    <ButtonLink href={`/videos/${videoId}/handout`} variant="secondary">
      {tHandout("open")}
    </ButtonLink>
  ) : (
    <p className="text-supporting text-ink-muted">{tHandout("lockedShort")}</p>
  );

  let todayTask;
  if (progress?.status === "passed") {
    todayTask = (
      <p className="text-supporting text-success">
        <span aria-hidden="true">✓ </span>
        {t("passed")}
      </p>
    );
  } else if (current === 7) {
    todayTask = <p className="text-ink-muted">{t("day7Soon")}</p>;
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
      <DayTracker statuses={statuses} onSelect={openDay} />
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

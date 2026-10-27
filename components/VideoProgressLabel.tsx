"use client";

import { useTranslations } from "next-intl";
import { isDevTestMode } from "@/lib/config";
import { currentDay, dayStatuses, taskForDay } from "@/lib/cycle";
import { toLocalDate } from "@/lib/dates";
import type { ProgressStore } from "@/lib/storage/progress-store";
import { useVideoProgress } from "./useVideoProgress";

type VideoProgressLabelProps = {
  videoId: string;
  /** Injected in tests; defaults to localStorage. */
  store?: ProgressStore;
};

/**
 * One line of progress for a library card: today's day and task, "today's
 * task done", or "passed", prefixed with the week from week 2. Nothing before
 * the video is started (or on the server).
 */
export function VideoProgressLabel({
  videoId,
  store,
}: VideoProgressLabelProps) {
  const t = useTranslations("cycle");
  const tDay = useTranslations("practice.day");
  const { progress } = useVideoProgress(videoId, store);
  if (!progress) return null;

  const week =
    progress.week > 1 ? `${t("week", { week: progress.week })} · ` : "";

  if (progress.status === "passed") {
    return (
      <p className="mt-2 text-supporting text-success">
        <span aria-hidden="true">✓ </span>
        {week}
        {t("passed")}
      </p>
    );
  }

  const day = currentDay(
    dayStatuses(progress, toLocalDate(new Date()), {
      ignoreDates: isDevTestMode(),
    }),
  );
  return (
    <p className="mt-2 text-supporting text-ink">
      {week}
      {day ? (
        t("dayTask", { day, task: tDay(`task.${taskForDay(day)}`) })
      ) : (
        <>
          <span aria-hidden="true" className="text-success">
            ✓{" "}
          </span>
          {t("todayDone")}
        </>
      )}
    </p>
  );
}

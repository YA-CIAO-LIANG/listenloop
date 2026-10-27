"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { isDevTestMode } from "@/lib/config";
import { lockReason, taskForDay, type CycleDay } from "@/lib/cycle";
import { toLocalDate } from "@/lib/dates";
import type { Progress } from "@/lib/progress";

type NextDayNoteProps = {
  videoId: string;
  /** The day just finished. */
  day: CycleDay;
  progress: Progress;
};

/**
 * One line on a completion screen about the following day: "opens
 * tomorrow", or a link once it is open (test mode, or a later visit).
 * Nothing when that day is already done or can't follow yet.
 */
export function NextDayNote({ videoId, day, progress }: NextDayNoteProps) {
  const t = useTranslations("cycle");
  const tDay = useTranslations("practice.day");
  if (day === 7) return null;
  const next = (day + 1) as CycleDay;
  if (progress.days[next]?.done) return null;

  const reason = lockReason(progress, next, toLocalDate(new Date()), {
    ignoreDates: isDevTestMode(),
  });
  const task = tDay(`task.${taskForDay(next)}`);

  if (reason === "tomorrow") {
    return (
      <p className="text-supporting text-ink-muted">
        {t("nextTomorrow", { day: next, task })}
      </p>
    );
  }
  if (reason !== null) return null;
  return (
    <p className="text-supporting">
      <Link
        href={`/videos/${videoId}/day/${next}`}
        className="text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
      >
        {t("nextOpen", { day: next })}
        <span aria-hidden="true"> →</span>
      </Link>
    </p>
  );
}

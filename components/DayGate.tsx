"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { isDevTestMode } from "@/lib/config";
import { lockReason, type CycleDay } from "@/lib/cycle";
import { toLocalDate } from "@/lib/dates";
import type { ProgressStore } from "@/lib/storage/progress-store";
import { ButtonLink } from "./ButtonLink";
import { useVideoProgress } from "./useVideoProgress";

type DayGateProps = {
  videoId: string;
  videoTitle: string;
  day: CycleDay;
  /** The day's practice; mounted only once the day is open. */
  children: ReactNode;
  /** Injected in tests; defaults to localStorage. */
  store?: ProgressStore;
};

/**
 * Keeps locked days closed, even when opened by URL: the practice (which
 * would create records) mounts only once the day is open. Locked days say why
 * and where to go instead. Progress lives in the browser, so this is checked
 * on the client.
 */
export function DayGate({
  videoId,
  videoTitle,
  day,
  children,
  store,
}: DayGateProps) {
  const t = useTranslations("cycle");
  const { progress, loaded } = useVideoProgress(videoId, store);

  if (!loaded) {
    return (
      <p role="status" className="practice-column text-ink-muted">
        {t("loading")}
      </p>
    );
  }

  const reason = lockReason(progress, day, toLocalDate(new Date()), {
    ignoreDates: isDevTestMode(),
  });
  if (!reason) return children;

  const previous = day - 1;
  return (
    <div className="practice-column space-y-4">
      <Link
        href={`/videos/${videoId}`}
        className="text-supporting text-ink-muted hover:text-ink"
      >
        <span aria-hidden="true">← </span>
        <span lang="en">{videoTitle}</span>
      </Link>
      <h1 className="font-display text-h3">{t("lockedTitle", { day })}</h1>
      <p>
        {reason === "previous"
          ? t("lockedPrevious", { previous })
          : reason === "tomorrow"
            ? t("lockedTomorrow", { previous, day })
            : t("lockedWeekClosed")}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {reason === "previous" && (
          <ButtonLink
            href={`/videos/${videoId}/day/${previous}`}
            variant="primary"
            arrow
          >
            {t("goDay", { day: previous })}
          </ButtonLink>
        )}
        <ButtonLink
          href={`/videos/${videoId}`}
          variant={reason === "previous" ? "ghost" : "secondary"}
        >
          {t("backToVideo")}
        </ButtonLink>
      </div>
    </div>
  );
}

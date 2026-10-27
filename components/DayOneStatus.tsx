"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { createLocalProgressStore } from "@/lib/storage/local-progress-store";
import type { ProgressStore } from "@/lib/storage/progress-store";
import { ButtonLink } from "./ButtonLink";

type DayOneStatusProps = {
  videoId: string;
  /** Injected in tests; defaults to localStorage. */
  store?: ProgressStore;
};

/**
 * Day 1 entry on the video page. Shows "Start Day 1" until the official run
 * is done, then a checked "Today's task done" with the official score and
 * "Practice again" (?retry=1). Progress lives in the browser, so the server
 * renders the start button and this switches once progress has loaded.
 */
export function DayOneStatus({ videoId, store }: DayOneStatusProps) {
  const t = useTranslations();
  const format = useFormatter();
  const [progressStore] = useState(() => store ?? createLocalProgressStore());
  // null = not done (or unknown yet), number = official Day 1 score.
  const [officialScore, setOfficialScore] = useState<number | null>(null);
  const dayHref = `/videos/${videoId}/day/1`;

  useEffect(() => {
    let cancelled = false;
    progressStore
      .get(videoId)
      .then((progress) => {
        const day = progress?.days[1];
        if (!cancelled && day?.done) setOfficialScore(day.score ?? 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [progressStore, videoId]);

  if (officialScore === null) {
    return (
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <ButtonLink href={dayHref} variant="primary" size="lg" arrow>
          {t("video.startDay1")}
        </ButtonLink>
        {/* The handout reveals the transcript, so it opens after Day 1. */}
        <p className="text-supporting text-ink-muted">
          {t("handout.lockedShort")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <p className="text-supporting text-success">
        <span aria-hidden="true">✓ </span>
        {t("dictation.todayDone")} ·{" "}
        {format.number(officialScore, {
          style: "percent",
          maximumFractionDigits: 0,
        })}
      </p>
      <ButtonLink href={`${dayHref}?retry=1`} variant="primary" arrow>
        {t("dictation.retry")}
      </ButtonLink>
      <ButtonLink href={dayHref} variant="secondary">
        {t("video.viewResult")}
      </ButtonLink>
      <ButtonLink href={`/videos/${videoId}/handout`} variant="secondary">
        {t("handout.open")}
      </ButtonLink>
    </div>
  );
}

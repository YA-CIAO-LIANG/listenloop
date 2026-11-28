"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { isDevTestMode } from "@/lib/config";
import { addDays } from "@/lib/dates";
import {
  DAY30_AFTER,
  day30State,
  writingLock,
  type WritingDayNumber,
} from "@/lib/writing/progress";
import type { WritingPrompt } from "@/lib/writing/types";
import { useToday } from "../useToday";
import { DrillDay } from "./DrillDay";
import { EssayDay } from "./EssayDay";
import { useWritingProgress } from "./WritingProvider";

/** A day of the week, or why it isn't open yet (D187). */
export function WritingDay({
  prompt,
  day,
  signedIn,
  title,
}: {
  prompt: WritingPrompt;
  day: WritingDayNumber;
  signedIn: boolean;
  title: string;
}) {
  const t = useTranslations("writing");
  const today = useToday();
  const progress = useWritingProgress(prompt.id);
  if (!today || progress === undefined) return null;
  if (day === 30) {
    // Open from 29 days after Day 1 of a finished week (D203).
    const state = day30State(progress, today);
    if (state === "open" || state === "done") {
      return (
        <EssayDay prompt={prompt} day={30} signedIn={signedIn} title={title} />
      );
    }
    return (
      <div className="flex flex-col gap-3" role="status">
        <p>
          {state === "early" && progress?.days[1]?.date
            ? t("overview.day30Early", {
                date: addDays(progress.days[1].date, DAY30_AFTER),
              })
            : t("overview.day30Closed")}
        </p>
        <Link
          href={`/writing/${prompt.id}`}
          className="tap inline-flex min-h-8 items-center underline pointer-coarse:min-h-11"
        >
          {t("essay.toOverview")}
        </Link>
      </div>
    );
  }
  const lock = writingLock(progress, day, today, {
    ignoreDates: isDevTestMode(),
  });
  if (lock) {
    return (
      <div className="flex flex-col gap-3" role="status">
        <p>{t(`overview.lockLong.${lock}`)}</p>
        <Link
          href={`/writing/${prompt.id}`}
          className="tap inline-flex min-h-8 items-center underline pointer-coarse:min-h-11"
        >
          {t("essay.toOverview")}
        </Link>
      </div>
    );
  }
  if (day === 1 || day === 7) {
    return (
      <EssayDay prompt={prompt} day={day} signedIn={signedIn} title={title} />
    );
  }
  return <DrillDay prompt={prompt} day={day} signedIn={signedIn} />;
}

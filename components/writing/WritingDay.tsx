"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { CycleDay } from "@/lib/cycle";
import { isDevTestMode } from "@/lib/config";
import { writingLock } from "@/lib/writing/progress";
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
  day: CycleDay;
  signedIn: boolean;
  title: string;
}) {
  const t = useTranslations("writing");
  const today = useToday();
  const progress = useWritingProgress(prompt.id);
  if (!today || progress === undefined) return null;
  const lock = writingLock(progress, day, today, {
    ignoreDates: isDevTestMode(),
  });
  if (lock) {
    return (
      <div className="flex flex-col gap-3" role="status">
        <p>{t(`overview.lockLong.${lock}`)}</p>
        <Link href={`/writing/${prompt.id}`} className="underline">
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
  return <DrillDay prompt={prompt} day={day} />;
}

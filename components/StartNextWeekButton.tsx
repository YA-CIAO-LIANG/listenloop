"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { startNextWeek } from "@/lib/cycle";
import { toLocalDate } from "@/lib/dates";
import type { Progress } from "@/lib/progress";
import type { ProgressStore } from "@/lib/storage/progress-store";
import { Button } from "./Button";

type StartNextWeekButtonProps = {
  /** A settled week that needs repeating (canStartNextWeek is true). */
  progress: Progress;
  store: ProgressStore;
};

/** Starts the same video again (history kept) and opens the new Day 1. */
export function StartNextWeekButton({
  progress,
  store,
}: StartNextWeekButtonProps) {
  const t = useTranslations("week");
  const router = useRouter();
  const [saveFailed, setSaveFailed] = useState(false);

  async function start() {
    try {
      await store.save(startNextWeek(progress, toLocalDate(new Date())));
    } catch {
      setSaveFailed(true);
      return;
    }
    router.push(`/videos/${progress.videoId}/day/1`);
  }

  return (
    <>
      <Button variant="primary" arrow onClick={() => void start()}>
        {t("startNext", { week: progress.week + 1 })}
      </Button>
      {saveFailed && (
        <p role="alert" className="w-full text-supporting text-error">
          {t("saveFailed")}
        </p>
      )}
    </>
  );
}

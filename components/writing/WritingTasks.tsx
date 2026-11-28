"use client";

import { useTranslations } from "next-intl";
import { currentDay } from "@/lib/cycle";
import { isDevTestMode } from "@/lib/config";
import { dueToday } from "@/lib/writing/notebook";
import { bedtimeDue, todaysSentences } from "@/lib/writing/bedtime";
import { day30State, writingStatuses } from "@/lib/writing/progress";
import { Button } from "../Button";
import { ButtonLink } from "../ButtonLink";
import { Card } from "../Card";
import { useToday } from "../useToday";
import { useCustomTitles } from "./CustomPrompts";
import {
  useAllWritingProgress,
  useNotebook,
  useWritingData,
  useWritingLog,
  useWritingSettings,
} from "./WritingProvider";

/**
 * Today's writing (D187): each prompt in progress with its day to do (or
 * "done for today"), and the notebook's reviews due. On the home page
 * next to the listening tasks, and on /writing. Titles come from the
 * page, which has the prompts.
 */
export function WritingTasks({
  titles: officialTitles,
  showEmpty = false,
}: {
  /** Prompt id → title to show. */
  titles: Record<string, string>;
  showEmpty?: boolean;
}) {
  const t = useTranslations("writingTasks");
  // The learner's own prompts too (D196), named on this device.
  const titles = { ...officialTitles, ...useCustomTitles() };
  const today = useToday();
  const all = useAllWritingProgress();
  const notebook = useNotebook();
  const log = useWritingLog();
  const settings = useWritingSettings();
  const { saveProgress } = useWritingData();
  if (!today || !all || !notebook || !log || !settings) return null;
  const active = all.filter(
    (p) => p.status === "in-progress" && titles[p.promptId],
  );
  const reviews = dueToday(notebook, today).length;
  // Day 30's rewrite (D203), for finished weeks.
  const day30 = settings.day30
    ? all.filter((p) => titles[p.promptId] && day30State(p, today) === "open")
    : [];
  // The evening review (D203), after the time set.
  const bedtime = bedtimeDue({
    on: settings.bedtime,
    at: settings.bedtimeAt,
    now: new Date(),
    today,
    log,
    sentences: todaysSentences(all, notebook, today),
  });
  if (!active.length && !reviews && !day30.length && !bedtime && !showEmpty) {
    return null;
  }

  return (
    <section
      aria-labelledby="writing-tasks"
      data-area="writing"
      className="flex flex-col gap-3"
    >
      <h2 id="writing-tasks" className="font-display text-h3">
        {t("heading")}
      </h2>
      {!active.length && !reviews && !day30.length && !bedtime && (
        <p className="text-ink-muted">{t("empty")}</p>
      )}
      <ul className="flex flex-col gap-3">
        {active.map((progress) => {
          const day = currentDay(
            writingStatuses(progress, today, { ignoreDates: isDevTestMode() }),
          );
          return (
            <li key={progress.promptId}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{titles[progress.promptId]}</p>
                  <p className="text-supporting text-ink-muted">
                    {day ? t("day", { day }) : t("doneToday")}
                  </p>
                </div>
                {day ? (
                  <ButtonLink
                    href={`/writing/${progress.promptId}/day/${day}`}
                    variant="primary"
                    size="sm"
                    arrow
                  >
                    {t("start")}
                  </ButtonLink>
                ) : (
                  <ButtonLink
                    href={`/writing/${progress.promptId}`}
                    variant="secondary"
                    size="sm"
                  >
                    {t("open")}
                  </ButtonLink>
                )}
              </Card>
            </li>
          );
        })}
        {day30.map((progress) => (
          <li key={`d30-${progress.promptId}`}>
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{titles[progress.promptId]}</p>
                <p className="text-supporting text-ink-muted">{t("day30")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ButtonLink
                  href={`/writing/${progress.promptId}/day/30`}
                  variant="primary"
                  size="sm"
                  arrow
                >
                  {t("day30Start")}
                </ButtonLink>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    saveProgress({
                      ...progress,
                      day30Skipped: progress.week,
                      updatedAt: new Date().toISOString(),
                    })
                  }
                >
                  {t("day30Skip")}
                </Button>
              </div>
            </Card>
          </li>
        ))}
        {bedtime && (
          <li>
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{t("bedtime")}</p>
                <p className="text-supporting text-ink-muted">
                  {t("bedtimeHint")}
                </p>
              </div>
              <ButtonLink
                href="/writing/review"
                variant="primary"
                size="sm"
                arrow
              >
                {t("bedtimeStart")}
              </ButtonLink>
            </Card>
          </li>
        )}
        {reviews > 0 && (
          <li>
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{t("notebook")}</p>
                <p className="text-supporting text-ink-muted">
                  {t("reviews", { count: reviews })}
                </p>
              </div>
              <ButtonLink
                href="/writing/notebook"
                variant="primary"
                size="sm"
                arrow
              >
                {t("review")}
              </ButtonLink>
            </Card>
          </li>
        )}
      </ul>
    </section>
  );
}

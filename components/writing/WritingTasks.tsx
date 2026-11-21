"use client";

import { useTranslations } from "next-intl";
import { currentDay } from "@/lib/cycle";
import { isDevTestMode } from "@/lib/config";
import { dueToday } from "@/lib/writing/notebook";
import { writingStatuses } from "@/lib/writing/progress";
import { ButtonLink } from "../ButtonLink";
import { Card } from "../Card";
import { useToday } from "../useToday";
import { useAllWritingProgress, useNotebook } from "./WritingProvider";

/**
 * Today's writing (D187): each prompt in progress with its day to do (or
 * "done for today"), and the notebook's reviews due. On the home page
 * next to the listening tasks, and on /writing. Titles come from the
 * page, which has the prompts.
 */
export function WritingTasks({
  titles,
  showEmpty = false,
}: {
  /** Prompt id → title to show. */
  titles: Record<string, string>;
  showEmpty?: boolean;
}) {
  const t = useTranslations("writingTasks");
  const today = useToday();
  const all = useAllWritingProgress();
  const notebook = useNotebook();
  if (!today || !all || !notebook) return null;
  const active = all.filter(
    (p) => p.status === "in-progress" && titles[p.promptId],
  );
  const reviews = dueToday(notebook, today).length;
  if (!active.length && !reviews && !showEmpty) return null;

  return (
    <section aria-labelledby="writing-tasks" className="flex flex-col gap-3">
      <h2 id="writing-tasks" className="font-display text-h3">
        {t("heading")}
      </h2>
      {!active.length && !reviews && (
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

"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { isDevTestMode } from "@/lib/config";
import { taskForDay } from "@/lib/cycle";
import { toLocalDate } from "@/lib/dates";
import type { Progress } from "@/lib/progress";
import { createLocalProgressStore } from "@/lib/storage/local-progress-store";
import type { ProgressStore } from "@/lib/storage/progress-store";
import { todayTasks, type TodayTask } from "@/lib/today-tasks";
import { getVideo } from "@/lib/video-library";
import { ButtonLink } from "./ButtonLink";
import { Card } from "./Card";
import { StartNextWeekButton } from "./StartNextWeekButton";

type TodayTasksProps = {
  /** Injected in tests; defaults to localStorage. */
  store?: ProgressStore;
};

const titleOf = (videoId: string) => getVideo(videoId)?.title;

/**
 * The home page's "today's tasks": one row per started practice with
 * today's day and task, its status (ready / ✓ done / what opens tomorrow),
 * and a button. With nothing started, a pointer to the library below.
 * Nothing shows until progress has loaded, so the empty note never flashes.
 */
export function TodayTasks({ store }: TodayTasksProps) {
  const t = useTranslations("today");
  const tCalendar = useTranslations("calendar");
  const tCycle = useTranslations("cycle");
  const tDay = useTranslations("practice.day");
  const [progressStore] = useState(() => store ?? createLocalProgressStore());
  const [progresses, setProgresses] = useState<Progress[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    progressStore
      .list()
      .catch(() => [])
      .then((list) => {
        if (!cancelled) setProgresses(list);
      });
    return () => {
      cancelled = true;
    };
  }, [progressStore]);

  const tasks = progresses
    ? todayTasks(progresses, toLocalDate(new Date()), {
        ignoreDates: isDevTestMode(),
        titleOf,
      })
    : null;

  const video = (chunks: ReactNode) => <span lang="en">{chunks}</span>;
  const line = (task: TodayTask) =>
    task.newWeek
      ? t.rich("newWeekLine", { title: task.title, week: task.week, video })
      : tCalendar.rich("taskLine", {
          title: task.title,
          day: task.day,
          task: tDay(`task.${taskForDay(task.day)}`),
          video,
        });
  const tomorrow = (task: TodayTask) =>
    task.tomorrow &&
    ("day" in task.tomorrow
      ? t("tomorrowDay", { day: task.tomorrow.day })
      : t("tomorrowWeek", { week: task.tomorrow.week }));

  function action(task: TodayTask) {
    const href = `/videos/${task.videoId}/day/${task.day}`;
    if (task.status === "done") {
      return (
        <ButtonLink href={`${href}?retry=1`} variant="secondary" size="sm">
          {t("retry")}
        </ButtonLink>
      );
    }
    const progress = progresses?.find((p) => p.videoId === task.videoId);
    if (task.newWeek && progress) {
      return <StartNextWeekButton progress={progress} store={progressStore} />;
    }
    return (
      <ButtonLink href={href} variant="primary" size="sm" arrow>
        {t("start")}
      </ButtonLink>
    );
  }

  return (
    <Card className="space-y-4">
      <h2 className="font-display text-h3">{t("title")}</h2>
      {tasks &&
        (tasks.length === 0 ? (
          <p className="text-supporting text-ink-muted">
            {t("empty")}{" "}
            <a
              href="#library"
              className="text-accent-ink underline underline-offset-4"
            >
              {t("emptyLink")}
              <span aria-hidden="true"> ↓</span>
            </a>
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {tasks.map((task) => (
              <li
                key={task.videoId}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="space-y-1">
                  <p>
                    {task.week > 1 && !task.newWeek && (
                      <span className="text-ink-muted">
                        {tCycle("week", { week: task.week })} ·{" "}
                      </span>
                    )}
                    {line(task)}
                  </p>
                  <p className="text-supporting">
                    {task.status === "done" ? (
                      <span className="text-success">
                        <span aria-hidden="true">✓ </span>
                        {t("done")}
                      </span>
                    ) : (
                      <span className="text-accent-ink">{t("available")}</span>
                    )}
                    {tomorrow(task) && (
                      <span className="text-ink-muted">
                        {" "}
                        · {tomorrow(task)}
                      </span>
                    )}
                  </p>
                </div>
                {action(task)}
              </li>
            ))}
          </ul>
        ))}
    </Card>
  );
}

"use client";

import { isHandoutUnlocked } from "@/lib/cycle";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import type { Activity } from "@/lib/activity";
import { streaks } from "@/lib/analytics";
import { isDevTestMode } from "@/lib/config";
import { taskForDay } from "@/lib/cycle";
import { toLocalDate } from "@/lib/dates";
import { titleLang } from "@/lib/practice-material";
import type { Progress } from "@/lib/progress";
import type { ProgressStore } from "@/lib/storage/progress-store";
import { dueReviews } from "@/lib/review";
import { recentFreeze } from "@/lib/streak";
import { todayTasks, type TodayTask } from "@/lib/today-tasks";
import { videoTitleLine } from "@/lib/video-library";
import { ButtonLink } from "./ButtonLink";
import { Card } from "./Card";
import { StartNextWeekButton } from "./StartNextWeekButton";
import { useStores } from "./StoresProvider";
import { useCustomPracticeTitles } from "./useCustomPracticeTitles";

type TodayTasksProps = {
  /** Injected in tests; defaults to localStorage. */
  store?: ProgressStore;
};

/**
 * The home page's "today's tasks": one row per started practice with
 * today's day and task, its status (ready / ✓ done / what opens tomorrow),
 * and a button. With nothing started, a pointer to the library below.
 * Nothing shows until progress has loaded, so the empty note never flashes.
 */
export function TodayTasks({ store }: TodayTasksProps) {
  const t = useTranslations("today");
  const tListen = useTranslations("listen");
  const tCalendar = useTranslations("calendar");
  const tCycle = useTranslations("cycle");
  const tDay = useTranslations("practice.day");
  const tStreak = useTranslations("streak");
  const format = useFormatter();
  const stores = useStores();
  const progressStore = store ?? stores.progress;
  const [progresses, setProgresses] = useState<Progress[] | null>(null);
  // Misheard words due today (D108) and the streak (D176) come from the
  // activity log.
  const [activity, setActivity] = useState<Activity | null>(null);

  useEffect(() => {
    let cancelled = false;
    progressStore
      .list()
      .catch(() => [])
      .then((list) => {
        if (!cancelled) setProgresses(list);
      });
    stores.rewards
      .getActivity()
      .then((log) => {
        if (!cancelled) setActivity(log);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [progressStore, stores.rewards]);

  const customTitles = useCustomPracticeTitles(
    progresses?.map((p) => p.videoId),
  );
  const today = toLocalDate(new Date());
  const reviews = activity
    ? dueReviews(activity.review ?? {}, today).length
    : 0;
  const tasks = progresses
    ? todayTasks(progresses, today, {
        ignoreDates: isDevTestMode(),
        titleOf: (videoId) => videoTitleLine(videoId) ?? customTitles[videoId],
      })
    : null;

  const line = (task: TodayTask) => {
    const video = (chunks: ReactNode) => (
      <span lang={titleLang(task.videoId)}>{chunks}</span>
    );
    return task.newWeek
      ? t.rich("newWeekLine", { title: task.title, week: task.week, video })
      : tCalendar.rich("taskLine", {
          title: task.title,
          day: task.day,
          task: tDay(`task.${taskForDay(task.day)}`),
          video,
        });
  };
  const tomorrow = (task: TodayTask) =>
    task.tomorrow &&
    ("day" in task.tomorrow
      ? t("tomorrowDay", {
          day: task.tomorrow.day,
          task: tDay(`task.${taskForDay(task.tomorrow.day)}`),
        })
      : t("tomorrowWeek", { week: task.tomorrow.week }));
  // What's next for the "all done" note: day, task, and material.
  const tomorrowLine = (task: TodayTask) => {
    const video = (chunks: ReactNode) => (
      <span lang={titleLang(task.videoId)}>{chunks}</span>
    );
    if (!task.tomorrow) return null;
    return "day" in task.tomorrow
      ? t.rich("allDoneTomorrowDay", {
          day: task.tomorrow.day,
          task: tDay(`task.${taskForDay(task.tomorrow.day)}`),
          title: task.title,
          video,
        })
      : t.rich("allDoneTomorrowWeek", {
          week: task.tomorrow.week,
          title: task.title,
          video,
        });
  };
  const allDone =
    tasks !== null &&
    tasks.length > 0 &&
    reviews === 0 &&
    tasks.every((task) => task.status === "done");
  const streak =
    progresses && activity ? streaks(activity, progresses, today) : null;
  const saved = streak && recentFreeze(streak, today);
  const shortDate = (date: string) =>
    // A calendar date, the same everywhere: noon UTC, shown in UTC.
    format.dateTime(new Date(`${date}T12:00:00Z`), {
      month: "numeric",
      day: "numeric",
      timeZone: "UTC",
    });

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
      {/* The heading stays the card's child: tests find the card by it. */}
      <h2 className="font-display text-h3">{t("title")}</h2>
      {/* The streak and its weekly freeze (D176), once there's a streak. */}
      {streak && streak.longest > 0 && (
        <div data-testid="streak" className="space-y-1 text-supporting">
          <p>
            {streak.current > 0 && (
              <span className="font-medium">
                {tStreak("line", { n: streak.current })} ·{" "}
              </span>
            )}
            <span className="text-ink-muted">
              {tStreak("freezesLeft", { n: streak.freezesLeft })}
            </span>
          </p>
          {saved && (
            <p className="text-accent-ink">
              {tStreak("saved", { date: shortDate(saved) })}
            </p>
          )}
          <p className="text-ink-muted">{tStreak("help")}</p>
        </div>
      )}
      {allDone && (
        // Today's done (D176): a check that draws itself once (not with
        // reduced motion: it's just there), then what opens tomorrow.
        <div
          role="status"
          className="space-y-2 rounded-base border border-success p-4"
        >
          <p className="flex items-center gap-2 font-medium text-success">
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="size-5 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path
                d="M3 8.5l3 3 7-7"
                strokeDasharray={24}
                className="animate-check-draw motion-reduce:animate-none"
              />
            </svg>
            {t("allDoneTitle")}
          </p>
          <p className="text-supporting text-ink-muted">{t("allDoneBody")}</p>
          {/* Lines, not a list: the task rows below are the list. */}
          {tasks.map(
            (task) =>
              task.tomorrow && (
                <p key={task.videoId} className="text-supporting">
                  {tomorrowLine(task)}
                </p>
              ),
          )}
        </div>
      )}
      {tasks &&
        (tasks.length === 0 && reviews === 0 ? (
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
            {reviews > 0 && (
              <li className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="space-y-1">
                  <p>{t("reviewLine", { count: reviews })}</p>
                  <p className="text-supporting text-ink-muted">
                    {t("reviewNote")}
                  </p>
                </div>
                <ButtonLink href="/review" variant="primary" size="sm" arrow>
                  {t("reviewStart")}
                </ButtonLink>
              </li>
            )}
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
                <div className="flex flex-wrap items-center gap-2">
                  {/* Listening mode, once Day 1 is done (D135). */}
                  {isHandoutUnlocked(
                    progresses?.find((p) => p.videoId === task.videoId) ?? null,
                  ) && (
                    <ButtonLink
                      href={`/videos/${task.videoId}/listen`}
                      variant="ghost"
                      size="sm"
                      aria-label={tListen("openFor", {
                        title: task.title,
                      })}
                    >
                      {tListen("short")}
                    </ButtonLink>
                  )}
                  {action(task)}
                </div>
              </li>
            ))}
          </ul>
        ))}
    </Card>
  );
}

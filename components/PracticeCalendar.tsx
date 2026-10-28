"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState, type FocusEvent, type PointerEvent } from "react";
import type { PracticeTask } from "@/lib/activity";
import { taskForDay, type CycleDay } from "@/lib/cycle";
import { toLocalDate, type LocalDate } from "@/lib/dates";
import { tasksByDate } from "@/lib/practice-calendar";
import { createLocalProgressStore } from "@/lib/storage/local-progress-store";
import { createLocalRewardStore } from "@/lib/storage/local-reward-store";
import type { ProgressStore } from "@/lib/storage/progress-store";
import type { RewardStore } from "@/lib/storage/reward-store";
import { getVideo } from "@/lib/video-library";
import { Button } from "./Button";
import { Card } from "./Card";

type PracticeCalendarProps = {
  /** Injected in tests; default to localStorage. */
  progress?: ProgressStore;
  rewards?: RewardStore;
};

/** Days of one month as LocalDates, padded with nulls to start on Sunday. */
function monthCells(year: number, month: number): (LocalDate | null)[] {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  return [
    ...Array<null>(first.getDay()).fill(null),
    ...Array.from({ length: days }, (_, i) =>
      toLocalDate(new Date(year, month, i + 1)),
    ),
  ];
}

/** A day's finished tasks, or a note that there were none. */
function TaskList({ tasks }: { tasks: PracticeTask[] }) {
  const t = useTranslations("calendar");
  const tDay = useTranslations("practice.day");
  if (tasks.length === 0) {
    return <p className="text-ink-muted">{t("none")}</p>;
  }
  return (
    <ul className="space-y-1">
      {tasks.map((task) => (
        <li key={`${task.videoId}:${task.week}:${task.day}`}>
          <span aria-hidden="true" className="text-success">
            ✓{" "}
          </span>
          {t.rich("taskLine", {
            title: getVideo(task.videoId)?.title ?? task.videoId,
            day: task.day,
            task: tDay(`task.${taskForDay(task.day as CycleDay)}`),
            video: (chunks) => <span lang="en">{chunks}</span>,
          })}
        </li>
      ))}
    </ul>
  );
}

/**
 * Dates are shown in UTC from UTC noon, so a day's name never shifts with
 * the viewer's time zone (or the server's).
 */
const UTC = { timeZone: "UTC" } as const;
const noonOf = (date: LocalDate) => new Date(`${date}T12:00:00Z`);
const utcNoon = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month, day, 12));

/**
 * The home page's practice calendar (this month first, Sunday first). Days
 * with finished official tasks get a dot; today is underlined. Hovering a
 * day (or reaching it with the keyboard) shows that day's tasks beside it;
 * clicking or tapping a day lists them under the calendar (today by default),
 * which is how phones see them.
 */
export function PracticeCalendar({ progress, rewards }: PracticeCalendarProps) {
  const t = useTranslations("calendar");
  const format = useFormatter();
  const [stores] = useState(() => ({
    progress: progress ?? createLocalProgressStore(),
    rewards: rewards ?? createLocalRewardStore(),
  }));
  const [tasks, setTasks] = useState<Map<LocalDate, PracticeTask[]> | null>(
    null,
  );
  const now = new Date();
  const today = toLocalDate(now);
  const [shown, setShown] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [selected, setSelected] = useState<LocalDate>(today);
  const [hovered, setHovered] = useState<LocalDate | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([stores.progress.list(), stores.rewards.getActivity()])
      .then(([progresses, activity]) => tasksByDate(activity, progresses))
      .catch(() => new Map<LocalDate, PracticeTask[]>())
      .then((byDate) => {
        if (!cancelled) setTasks(byDate);
      });
    return () => {
      cancelled = true;
    };
  }, [stores]);

  const tasksOn = (date: LocalDate) => tasks?.get(date) ?? [];
  const dayName = (date: LocalDate) =>
    format.dateTime(noonOf(date), { ...UTC, month: "long", day: "numeric" });
  const cells = monthCells(shown.year, shown.month);
  const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, i) =>
    cells.slice(i * 7, i * 7 + 7),
  );
  // 2026-10-25 was a Sunday: weekday names from the locale, Sunday first.
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    format.dateTime(utcNoon(2026, 9, 25 + i), { ...UTC, weekday: "narrow" }),
  );
  const move = (step: number) =>
    setShown(({ year, month }) => {
      const date = new Date(year, month + step, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });

  // Mouse hover shows the tooltip; touch uses the list below instead.
  const onPointerEnter = (date: LocalDate) => (event: PointerEvent) => {
    if (event.pointerType === "mouse") setHovered(date);
  };
  // Keyboard focus shows it too (not the focus a tap leaves behind).
  const onFocus = (date: LocalDate) => (event: FocusEvent<HTMLElement>) => {
    try {
      if (event.currentTarget.matches(":focus-visible")) setHovered(date);
    } catch {
      setHovered(date);
    }
  };

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-h3">
          {t("title")}
          <span className="sr-only"> · </span>
          <span
            className="ml-3 text-supporting font-normal text-ink-muted"
            aria-live="polite"
          >
            {format.dateTime(utcNoon(shown.year, shown.month, 1), {
              ...UTC,
              year: "numeric",
              month: "long",
            })}
          </span>
        </h2>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => move(-1)}>
            <span aria-hidden="true">← </span>
            {t("previousMonth")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => move(1)}>
            {t("nextMonth")}
            <span aria-hidden="true"> →</span>
          </Button>
        </div>
      </div>

      <table className="w-full table-fixed text-center text-supporting tabular-nums">
        <caption className="sr-only">{t("caption")}</caption>
        <thead>
          <tr>
            {weekdays.map((day, i) => (
              <th
                key={i}
                scope="col"
                className="pb-2 text-metadata font-normal text-ink-muted"
              >
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, w) => (
            <tr key={w}>
              {week.map((date, d) => {
                if (!date) return <td key={d} />;
                const count = tasksOn(date).length;
                const isToday = date === today;
                const tipId = `practice-tip-${date}`;
                return (
                  <td key={d} className="relative py-1">
                    <button
                      type="button"
                      aria-pressed={selected === date}
                      aria-label={t("dayLabel", {
                        date: dayName(date),
                        count,
                        today: isToday ? "yes" : "no",
                      })}
                      aria-describedby={hovered === date ? tipId : undefined}
                      onClick={() => setSelected(date)}
                      onPointerEnter={onPointerEnter(date)}
                      onPointerLeave={() => setHovered(null)}
                      onFocus={onFocus(date)}
                      onBlur={() => setHovered(null)}
                      className={`mx-auto flex size-9 flex-col items-center justify-center gap-0.5 rounded-base pointer-coarse:size-11 ${
                        selected === date ? "bg-band" : "hover:bg-ink/4"
                      } ${
                        isToday
                          ? "text-ink underline decoration-accent decoration-2 underline-offset-4"
                          : count > 0
                            ? "text-ink"
                            : "text-ink-muted"
                      }`}
                    >
                      <span aria-hidden="true">{Number(date.slice(8))}</span>
                      <span
                        aria-hidden="true"
                        data-practiced={count > 0 || undefined}
                        className={`size-1.5 rounded-full ${
                          count > 0 ? "bg-accent" : "bg-transparent"
                        }`}
                      />
                    </button>
                    {hovered === date && (
                      <div
                        id={tipId}
                        role="tooltip"
                        className="absolute bottom-full left-1/2 z-10 mb-1 w-max max-w-64 -translate-x-1/2 rounded-base border border-line bg-surface p-3 text-left text-supporting"
                      >
                        <p className="mb-1 text-metadata text-ink-muted">
                          {dayName(date)}
                        </p>
                        <TaskList tasks={tasksOn(date)} />
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <section
        aria-live="polite"
        className="space-y-2 border-t border-line pt-4 text-supporting"
      >
        <h3 className="text-metadata tracking-widest text-ink-muted uppercase">
          {dayName(selected)}
          {selected === today ? ` · ${t("today")}` : ""}
        </h3>
        <TaskList tasks={tasksOn(selected)} />
      </section>
    </Card>
  );
}

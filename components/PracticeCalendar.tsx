"use client";

import { useFormatter, useTranslations } from "next-intl";
import {
  useEffect,
  useMemo,
  useState,
  type FocusEvent,
  type PointerEvent,
} from "react";
import type { PracticeTask } from "@/lib/activity";
import { taskForDay, type CycleDay } from "@/lib/cycle";
import { toLocalDate, type LocalDate } from "@/lib/dates";
import { heatLevel, tasksByDate } from "@/lib/practice-calendar";
import {
  hoursAndMinutes,
  PRACTICE_RINGS,
  ringLevel,
} from "@/lib/practice-rings";
import { practiceMinutes } from "@/lib/practice-time";
import { isCustomPracticeId, titleLang } from "@/lib/practice-material";
import type { ProgressStore } from "@/lib/storage/progress-store";
import type { RewardStore } from "@/lib/storage/reward-store";
import { videoTitleLine } from "@/lib/video-library";
import { useCustomPracticeTitles } from "./useCustomPracticeTitles";
import { Button } from "./Button";
import { Card } from "./Card";
import { HEAT_BACKGROUND, HEAT_LEVELS, HEAT_TEXT } from "./heat-colors";
import { RING_CLASS, RING_SAMPLE_CLASS } from "./practice-rings";
import { Skeleton } from "./Skeleton";
import { useStores } from "./StoresProvider";
import { useToday } from "./useToday";

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
function TaskList({
  tasks,
  customTitles,
}: {
  tasks: PracticeTask[];
  customTitles: Record<string, string>;
}) {
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
            title:
              videoTitleLine(task.videoId) ??
              customTitles[task.videoId] ??
              (isCustomPracticeId(task.videoId)
                ? t("customPractice")
                : task.videoId),
            day: task.day,
            task: tDay(`task.${taskForDay(task.day as CycleDay)}`),
            video: (chunks) => (
              <span lang={titleLang(task.videoId)}>{chunks}</span>
            ),
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
 * The home page's practice calendar (this month first, Sunday first): a heat
 * map where each day's color steps up with the official tasks finished
 * (heatLevel), with a less → more legend; today is underlined. A ring
 * around a day's number shows the time practiced that day (D181), thicker
 * for longer, explained by a legend below; the tooltip, the list under the
 * calendar, and the screen reader say the time in words. Hovering a
 * day (or reaching it with the keyboard) shows its count and tasks beside
 * it; clicking or tapping a day lists them under the calendar (today by
 * default), which is how phones see them. Phones (below `split`) show only
 * this week until "show the month" is pressed; the rows are hidden with CSS
 * so the server and the browser render the same markup. Day buttons fill
 * their column up to 36 px (44 px on touch screens) and shrink with it, so
 * seven of them fit side by side at 360 px without overlapping.
 */
export function PracticeCalendar(props: PracticeCalendarProps) {
  const t = useTranslations("calendar");
  const today = useToday();
  // The month is drawn in the browser only, where "today" is the viewer's.
  if (!today) {
    return (
      <Card className="space-y-4 max-split:p-4">
        <h2 className="font-display text-h3">{t("title")}</h2>
        <p role="status" className="sr-only">
          {t("loading")}
        </p>
        <Skeleton className="h-48 split:h-72" />
      </Card>
    );
  }
  return <CalendarMonth {...props} today={today} />;
}

function CalendarMonth({
  progress,
  rewards,
  today,
}: PracticeCalendarProps & { today: LocalDate }) {
  const t = useTranslations("calendar");
  const format = useFormatter();
  const contextStores = useStores();
  const stores = useMemo(
    () => ({
      progress: progress ?? contextStores.progress,
      rewards: rewards ?? contextStores.rewards,
    }),
    [progress, rewards, contextStores],
  );
  const [tasks, setTasks] = useState<Map<LocalDate, PracticeTask[]> | null>(
    null,
  );
  // Practice minutes per day (D181), as the stats page counts them.
  const [minutes, setMinutes] = useState<Map<LocalDate, number>>(new Map());
  const [shown, setShown] = useState({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)) - 1,
  });
  const [selected, setSelected] = useState<LocalDate>(today);
  const [hovered, setHovered] = useState<LocalDate | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([stores.progress.list(), stores.rewards.getActivity()])
      .then(([progresses, activity]) => ({
        byDate: tasksByDate(activity, progresses),
        time: new Map(
          Object.entries(activity.days).map(([date, day]) => [
            date,
            practiceMinutes(day),
          ]),
        ),
      }))
      .catch(() => ({
        byDate: new Map<LocalDate, PracticeTask[]>(),
        time: new Map<LocalDate, number>(),
      }))
      .then(({ byDate, time }) => {
        if (cancelled) return;
        setTasks(byDate);
        setMinutes(time);
      });
    return () => {
      cancelled = true;
    };
  }, [stores]);

  const tasksOn = (date: LocalDate) => tasks?.get(date) ?? [];
  const minutesOn = (date: LocalDate) => minutes.get(date) ?? 0;
  /** "Practiced 1 hr 12 min", or "No practice time". */
  const timeText = (date: LocalDate) => {
    const total = minutesOn(date);
    if (total === 0) return t("noPracticeTime");
    const { hours, minutes: rest } = hoursAndMinutes(total);
    const parts = [
      ...(hours > 0 ? [t("hours", { n: hours })] : []),
      ...(rest > 0 ? [t("minutes", { n: rest })] : []),
    ];
    return t("practiceTime", { duration: parts.join(" ") });
  };
  const customTitles = useCustomPracticeTitles(
    tasks && [...tasks.values()].flat().map((task) => task.videoId),
  );
  const dayName = (date: LocalDate) =>
    format.dateTime(noonOf(date), { ...UTC, month: "long", day: "numeric" });
  const cells = monthCells(shown.year, shown.month);
  const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, i) =>
    cells.slice(i * 7, i * 7 + 7),
  );
  // Collapsed (phones): only the week with today, in today's month.
  const thisWeek = weeks.findIndex((week) => week.includes(today));
  const collapsed = !expanded && thisWeek !== -1;
  const tableId = "practice-calendar-days";
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
    <Card className="space-y-4 max-split:p-4">
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
        <div className={`gap-1 ${collapsed ? "hidden split:flex" : "flex"}`}>
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

      <table
        id={tableId}
        className="w-full table-fixed text-center text-supporting tabular-nums"
      >
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
            <tr
              key={w}
              className={
                collapsed && w !== thisWeek
                  ? "hidden split:table-row"
                  : undefined
              }
            >
              {week.map((date, d) => {
                if (!date) return <td key={d} />;
                const count = tasksOn(date).length;
                const level = heatLevel(count);
                const ring = ringLevel(minutesOn(date));
                const isToday = date === today;
                const tipId = `practice-tip-${date}`;
                return (
                  <td key={d} className="relative p-px split:p-0.5">
                    <button
                      type="button"
                      data-level={level}
                      data-ring={ring}
                      aria-pressed={selected === date}
                      aria-label={t("dayLabel", {
                        date: dayName(date),
                        time: timeText(date),
                        count,
                        today: isToday ? "yes" : "no",
                      })}
                      aria-describedby={hovered === date ? tipId : undefined}
                      onClick={() => setSelected(date)}
                      onPointerEnter={onPointerEnter(date)}
                      onPointerLeave={() => setHovered(null)}
                      onFocus={onFocus(date)}
                      onBlur={() => setHovered(null)}
                      className={`mx-auto flex aspect-square w-full max-w-10 items-center justify-center rounded-full pointer-coarse:max-w-11 ${
                        selected === date ? "bg-ink/8" : "hover:bg-ink/5"
                      }`}
                    >
                      {/* The day's dot: filled by tasks finished, ringed
                          by time practiced (D182). */}
                      <span
                        aria-hidden="true"
                        className={`flex size-7 items-center justify-center rounded-full ${
                          count > 0 ? HEAT_BACKGROUND[level] : ""
                        } ${
                          count > 0 || ring !== 0
                            ? HEAT_TEXT[level === 0 ? 1 : level]
                            : HEAT_TEXT[0]
                        } ${ring !== 0 ? RING_CLASS[ring] : ""} ${
                          isToday
                            ? `font-semibold underline decoration-2 underline-offset-4 ${
                                level >= 3
                                  ? "decoration-current"
                                  : "decoration-accent"
                              }`
                            : ""
                        }`}
                      >
                        {Number(date.slice(8))}
                      </span>
                    </button>
                    {hovered === date && (
                      <div
                        id={tipId}
                        role="tooltip"
                        className="absolute bottom-full left-1/2 z-10 mb-1 w-max max-w-64 -translate-x-1/2 rounded-base border border-line surface-card p-3 text-left text-supporting"
                      >
                        <p className="mb-1 text-metadata text-ink-muted">
                          {dayName(date)} · {t("tipCount", { count })}
                        </p>
                        <p className="mb-1">{timeText(date)}</p>
                        <TaskList
                          tasks={tasksOn(date)}
                          customTitles={customTitles}
                        />
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {thisWeek !== -1 && (
        <Button
          variant="ghost"
          size="sm"
          className="split:hidden"
          aria-expanded={expanded}
          aria-controls={tableId}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? t("collapse") : t("expand")}
          <span aria-hidden="true"> {expanded ? "▴" : "▾"}</span>
        </Button>
      )}

      {/* One row of legends (D182): time rings, then tasks. */}
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 text-metadata text-ink-muted">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p id="practice-ring-legend">{t("ringLegend")}</p>
          <ul
            aria-labelledby="practice-ring-legend"
            className="flex flex-wrap items-center gap-x-4 gap-y-2"
          >
            {PRACTICE_RINGS.map(({ level, minMinutes }) => (
              <li key={level} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  data-legend-ring={level}
                  className={`inline-block size-2.5 rounded-full ${RING_SAMPLE_CLASS[level]}`}
                />
                {minMinutes % 60 === 0
                  ? t("atLeastHours", { n: minMinutes / 60 })
                  : t("atLeastMinutes", { n: minMinutes })}
              </li>
            ))}
          </ul>
        </div>
        <p aria-hidden="true" className="flex items-center gap-1.5">
          {t("legendLess")}
          {HEAT_LEVELS.map((level) => (
            <span
              key={level}
              data-legend-level={level}
              className={`size-3 rounded-full ${
                level === 0 ? "border border-line" : HEAT_BACKGROUND[level]
              }`}
            />
          ))}
          {t("legendMore")}
        </p>
      </div>

      <section
        aria-live="polite"
        className="space-y-2 border-t border-line pt-4 text-supporting"
      >
        <h3 className="text-metadata tracking-widest text-ink-muted uppercase">
          {dayName(selected)}
          {selected === today ? ` · ${t("today")}` : ""}
        </h3>
        <p data-testid="calendar-day-time">{timeText(selected)}</p>
        <TaskList tasks={tasksOn(selected)} customTitles={customTitles} />
      </section>
    </Card>
  );
}

"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toLocalDate, type LocalDate } from "@/lib/dates";
import { heatLevel } from "@/lib/practice-calendar";
import {
  hoursAndMinutes,
  PRACTICE_RINGS,
  ringLevel,
} from "@/lib/practice-rings";
import { practiceMinutes } from "@/lib/practice-time";
import {
  isEssayDay,
  isWritingTimeId,
  writingCalendar,
  type WritingCalendarDay,
  type WritingLogEntry,
} from "@/lib/writing/log";
import { Button } from "../Button";
import { Card } from "../Card";
import { HEAT_BACKGROUND, HEAT_TEXT } from "../heat-colors";
import { ChatIcon, PenIcon, RepeatIcon } from "../icons";
import { glowStyle } from "../practice-rings";
import { Skeleton } from "../Skeleton";
import { useStores } from "../StoresProvider";
import { useToday } from "../useToday";
import { useCustomTitles } from "./CustomPrompts";
import {
  useAllWritingProgress,
  useChats,
  useWritingLog,
} from "./WritingProvider";

/** Dates shown from UTC noon, so a day's name never shifts (like D181). */
const UTC = { timeZone: "UTC" } as const;
const noonOf = (date: LocalDate) => new Date(`${date}T12:00:00Z`);
const utcNoon = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month, day, 12));

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

const EMPTY: WritingCalendarDay = {
  tasks: [],
  extras: [],
  chats: 0,
  essay: false,
  review: false,
  accuracy: null,
};

/** Writing practice minutes per day (D201): the "w-" materials only. */
export function useWritingMinutes(): Map<LocalDate, number> {
  const { rewards } = useStores();
  const [minutes, setMinutes] = useState<Map<LocalDate, number>>(new Map());
  useEffect(() => {
    let cancelled = false;
    rewards
      .getActivity()
      .then((activity) =>
        Object.entries(activity.days).map(
          ([date, day]) =>
            [date, practiceMinutes(day, isWritingTimeId)] as [
              LocalDate,
              number,
            ],
        ),
      )
      .catch(() => [])
      .then((list) => {
        if (!cancelled) setMinutes(new Map(list));
      });
    return () => {
      cancelled = true;
    };
  }, [rewards]);
  return minutes;
}

/**
 * The writing calendar on /writing (D201), a month at a time, Sunday
 * first, drawn like the home page's practice calendar (D181–D183):
 * - each day's dot filled by the cycle days finished (heatLevel),
 * - a glow by the writing time that day (practice-ring thresholds),
 * - small marks under it: an essay written, a chat, extra practice;
 * - today underlined.
 * Choosing a day lists its time, the days finished (with links), the
 * extra sets and chats, and the day's accuracy; screen readers hear all
 * of it in each day's name.
 */
export function WritingCalendar({
  titles: official,
}: {
  /** Official prompts' titles, from the page. */
  titles: Record<string, string>;
}) {
  const t = useTranslations("writingCalendar");
  const today = useToday();
  const log = useWritingLog();
  const progresses = useAllWritingProgress();
  const chats = useChats();
  if (!today || !log || !progresses || !chats) {
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
  return (
    <CalendarMonth
      today={today}
      days={writingCalendar(log, progresses, chats)}
      official={official}
    />
  );
}

function CalendarMonth({
  today,
  days,
  official,
}: {
  today: LocalDate;
  days: Map<LocalDate, WritingCalendarDay>;
  official: Record<string, string>;
}) {
  const t = useTranslations("writingCalendar");
  const tc = useTranslations("calendar");
  const format = useFormatter();
  const minutes = useWritingMinutes();
  const titles = { ...official, ...useCustomTitles() };
  const [shown, setShown] = useState({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)) - 1,
  });
  const [selected, setSelected] = useState<LocalDate>(today);

  const dayOf = (date: LocalDate) => days.get(date) ?? EMPTY;
  const minutesOn = (date: LocalDate) => minutes.get(date) ?? 0;
  const dayName = (date: LocalDate) =>
    format.dateTime(noonOf(date), { ...UTC, month: "long", day: "numeric" });
  const timeText = (date: LocalDate) => {
    const total = minutesOn(date);
    if (total === 0) return t("noTime");
    const { hours, minutes: rest } = hoursAndMinutes(total);
    const parts = [
      ...(hours > 0 ? [tc("hours", { n: hours })] : []),
      ...(rest > 0 ? [tc("minutes", { n: rest })] : []),
    ];
    return t("time", { duration: parts.join(" ") });
  };
  const titleOf = (id?: string) => (id && titles[id]) || t("untitled");
  /** What a day holds, in words: the button's name for screen readers. */
  const summary = (date: LocalDate) => {
    const d = dayOf(date);
    const parts = [
      d.tasks.length
        ? t("sr.tasks", {
            list: d.tasks
              .map((task) => t("dayN", { n: task.day ?? 0 }))
              .join("、"),
          })
        : t("sr.noTask"),
      timeText(date),
      ...(d.essay ? [t("sr.essay")] : []),
      ...(d.chats ? [t("sr.chats", { count: d.chats })] : []),
      ...(d.extras.length ? [t("sr.extras", { count: d.extras.length })] : []),
      ...(d.review ? [t("sr.review")] : []),
      ...(d.accuracy !== null
        ? [t("dayAccuracy", { percent: d.accuracy })]
        : []),
    ];
    return `${dayName(date)}${date === today ? ` · ${t("today")}` : ""}：${parts.join("；")}`;
  };

  const cells = monthCells(shown.year, shown.month);
  const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, i) =>
    cells.slice(i * 7, i * 7 + 7),
  );
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    format.dateTime(utcNoon(2026, 9, 25 + i), { ...UTC, weekday: "narrow" }),
  );
  const move = (step: number) =>
    setShown(({ year, month }) => {
      const date = new Date(year, month + step, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  const chosen = dayOf(selected);

  return (
    <Card className="space-y-4 max-split:p-4" data-testid="writing-calendar">
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
            {tc("previousMonth")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => move(1)}>
            {tc("nextMonth")}
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
              {week.map((date, i) => {
                if (!date) return <td key={i} />;
                const d = dayOf(date);
                const count = d.tasks.length;
                const level = heatLevel(count);
                const ring = ringLevel(minutesOn(date));
                const isToday = date === today;
                return (
                  <td key={i} className="p-px align-top split:p-0.5">
                    <button
                      type="button"
                      aria-pressed={selected === date}
                      aria-label={summary(date)}
                      data-level={level}
                      data-ring={ring}
                      onClick={() => setSelected(date)}
                      className={`mx-auto flex w-full max-w-12 flex-col items-center gap-0.5 rounded-base py-1 pointer-coarse:min-h-11 ${
                        selected === date ? "bg-ink/8" : "hover:bg-ink/5"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        style={ring !== 0 ? glowStyle(ring) : undefined}
                        className={`flex size-7 items-center justify-center rounded-full ${
                          count > 0 ? HEAT_BACKGROUND[level] : ""
                        } ${
                          count > 0 || ring !== 0
                            ? HEAT_TEXT[level === 0 ? 1 : level]
                            : HEAT_TEXT[0]
                        } ${
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
                      <span
                        aria-hidden="true"
                        className="flex h-3 items-center gap-0.5 text-accent-ink"
                      >
                        {d.essay && <PenIcon className="size-3" />}
                        {d.chats > 0 && <ChatIcon className="size-3" />}
                        {d.extras.length > 0 && (
                          <RepeatIcon className="size-3" />
                        )}
                      </span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 text-metadata text-ink-muted">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p id="writing-ring-legend">{tc("ringLegend")}</p>
          <ul
            aria-labelledby="writing-ring-legend"
            className="flex flex-wrap items-center gap-x-5 gap-y-2"
          >
            {PRACTICE_RINGS.map(({ level, minMinutes }) => (
              <li key={level} className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  style={glowStyle(level, 0.6)}
                  className="inline-block size-2.5 rounded-full border border-line"
                />
                {minMinutes % 60 === 0
                  ? tc("atLeastHours", { n: minMinutes / 60 })
                  : tc("atLeastMinutes", { n: minMinutes })}
              </li>
            ))}
          </ul>
        </div>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <li className="flex items-center gap-1.5">
            <PenIcon className="size-3.5 text-accent-ink" />
            {t("legend.essay")}
          </li>
          <li className="flex items-center gap-1.5">
            <ChatIcon className="size-3.5 text-accent-ink" />
            {t("legend.chat")}
          </li>
          <li className="flex items-center gap-1.5">
            <RepeatIcon className="size-3.5 text-accent-ink" />
            {t("legend.extra")}
          </li>
        </ul>
      </div>

      <section
        aria-live="polite"
        data-testid="writing-calendar-day"
        className="space-y-2 border-t border-line pt-4 text-supporting"
      >
        <h3 className="text-metadata tracking-widest text-ink-muted uppercase">
          {dayName(selected)}
          {selected === today ? ` · ${t("today")}` : ""}
        </h3>
        <p>{timeText(selected)}</p>
        {chosen.tasks.length === 0 &&
        chosen.extras.length === 0 &&
        chosen.chats === 0 &&
        !chosen.review ? (
          <p className="text-ink-muted">{t("none")}</p>
        ) : (
          <ul className="space-y-1">
            {chosen.tasks.map((task) => (
              <TaskLine
                key={task.id}
                entry={task}
                title={titleOf(task.promptId)}
              />
            ))}
            {chosen.extras.map((extra) => (
              <li key={extra.id}>
                <RepeatIcon className="mr-1 inline size-3.5 text-accent-ink" />
                <Link
                  href={`/writing/${extra.promptId}/day/${extra.day}`}
                  className="underline"
                >
                  {t("extraLine", {
                    title: titleOf(extra.promptId),
                    percent: extra.percent ?? 0,
                  })}
                </Link>
              </li>
            ))}
            {chosen.review && (
              <li>
                <span aria-hidden="true" className="text-success">
                  ✓{" "}
                </span>
                {t("reviewLine")}
              </li>
            )}
            {chosen.chats > 0 && (
              <li>
                <ChatIcon className="mr-1 inline size-3.5 text-accent-ink" />
                <Link href="/writing/chat" className="underline">
                  {t("chatLine", { count: chosen.chats })}
                </Link>
              </li>
            )}
          </ul>
        )}
        {chosen.accuracy !== null && (
          <p className="font-medium">
            {t("dayAccuracy", { percent: chosen.accuracy })}
          </p>
        )}
      </section>
    </Card>
  );
}

function TaskLine({ entry, title }: { entry: WritingLogEntry; title: string }) {
  const t = useTranslations("writingCalendar");
  const essay = isEssayDay(entry.day);
  return (
    <li>
      <span aria-hidden="true" className="text-success">
        ✓{" "}
      </span>
      <Link
        href={`/writing/${entry.promptId}/day/${entry.day}`}
        className="underline"
      >
        {t("taskLine", {
          title,
          day: entry.day ?? 0,
          kind:
            entry.day === 1 ? "essay" : entry.day === 7 ? "rewrite" : "back",
        })}
      </Link>
      {typeof entry.percent === "number" && (
        <span className="ml-2 text-ink-muted tabular-nums">
          {essay
            ? t("score", { percent: entry.percent })
            : t("accuracy", { percent: entry.percent })}
        </span>
      )}
    </li>
  );
}

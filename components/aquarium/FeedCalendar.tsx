"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toLocalDate, type LocalDate } from "@/lib/dates";
import { fedDates } from "@/lib/feeding";
import type { RewardStore } from "@/lib/storage/reward-store";
import { Button } from "../Button";
import { Card } from "../Card";
import { FeedIcon } from "../icons";
import { useAquariumWallet } from "./useAquariumWallet";

type FeedCalendarProps = {
  /** Injected in tests; defaults to localStorage. */
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

/**
 * A month calendar (this month first, Sunday first) where every day the
 * fish were fed shows the feed icon; today is underlined. Earlier and later
 * months are a click away.
 */
export function FeedCalendar({ rewards }: FeedCalendarProps) {
  const t = useTranslations("aquarium");
  const format = useFormatter();
  const { wallet } = useAquariumWallet(rewards);
  const now = new Date();
  const [shown, setShown] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const today = toLocalDate(now);
  const fed = new Set(wallet ? fedDates(wallet) : []);
  const cells = monthCells(shown.year, shown.month);
  const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, i) =>
    cells.slice(i * 7, i * 7 + 7),
  );
  // 2026-10-25 was a Sunday: weekday names from the locale, Sunday first.
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    format.dateTime(new Date(2026, 9, 25 + i), { weekday: "narrow" }),
  );
  const move = (step: number) =>
    setShown(({ year, month }) => {
      const date = new Date(year, month + step, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });

  return (
    <Card data-solid className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-h3" aria-live="polite">
          {format.dateTime(new Date(shown.year, shown.month, 1), {
            year: "numeric",
            month: "long",
          })}
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
        <caption className="sr-only">{t("calendarCaption")}</caption>
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
                const isFed = fed.has(date);
                const label = format.dateTime(new Date(`${date}T12:00:00`), {
                  month: "long",
                  day: "numeric",
                });
                return (
                  <td key={d} className="py-1">
                    <span
                      className={`mx-auto flex size-9 flex-col items-center justify-center rounded-base ${
                        date === today
                          ? "text-ink underline decoration-accent decoration-2 underline-offset-4"
                          : "text-ink-muted"
                      }`}
                    >
                      <span aria-hidden="true">{Number(date.slice(8))}</span>
                      {isFed && (
                        <FeedIcon data-fed className="size-3 text-accent-ink" />
                      )}
                      <span className="sr-only">
                        {t("dayLabel", {
                          date: label,
                          fed: isFed ? "yes" : "no",
                          today: date === today ? "yes" : "no",
                        })}
                      </span>
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

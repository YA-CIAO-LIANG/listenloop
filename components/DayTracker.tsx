"use client";

import { useTranslations } from "next-intl";
import {
  DAYS_PER_CYCLE,
  taskForDay,
  type CycleDay,
  type DayStatus,
} from "@/lib/cycle";
import { LockIcon } from "./icons";
import { usePress } from "./usePress";

type DayTrackerProps = {
  /** Status for Day 1–7, in order. */
  statuses: readonly DayStatus[];
  /** Makes unlocked days buttons (e.g. open that day's practice). */
  onSelect?: (day: CycleDay) => void;
};

/**
 * Seven equal cells: serif day number, a status mark (accent dot when done,
 * lock when locked), and the task name on wider screens. Today gets an accent
 * underline. Each cell has a full screen-reader label.
 */
export function DayTracker({ statuses, onSelect }: DayTrackerProps) {
  const t = useTranslations("practice.day");

  return (
    <ol
      aria-label={t("tracker")}
      className="grid grid-cols-7 divide-x divide-line border-y border-line"
    >
      {statuses.slice(0, DAYS_PER_CYCLE).map((status, index) => {
        const day = (index + 1) as CycleDay;
        return (
          <li key={day} className="flex">
            <DayCell day={day} status={status} onSelect={onSelect} />
          </li>
        );
      })}
    </ol>
  );
}

function DayCell({
  day,
  status,
  onSelect,
}: {
  day: CycleDay;
  status: DayStatus;
  onSelect?: (day: CycleDay) => void;
}) {
  const t = useTranslations("practice.day");
  const { pressProps, rippleLayer } = usePress<HTMLButtonElement>({});
  const task = taskForDay(day);
  const locked = status === "locked";

  const className = [
    "relative flex min-h-11 w-full flex-col items-center gap-1 px-1 py-3",
    locked ? "text-ink-muted" : "text-ink",
    status === "today"
      ? "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-accent"
      : "",
  ].join(" ");

  const content = (
    <>
      <span className="sr-only">
        {t("cellLabel", {
          day,
          task: t(`task.${task}`),
          status: t(`status.${status}`),
        })}
      </span>
      <span aria-hidden="true" className="font-display text-h3 tabular-nums">
        {day}
      </span>
      <span aria-hidden="true" className="flex h-4 items-center justify-center">
        {status === "done" && (
          <span className="size-2 bg-accent" style={{ borderRadius: "50%" }} />
        )}
        {locked && <LockIcon className="size-3.5" />}
      </span>
      {/* Task names don't fit 7 columns on phones; screen readers still get them. */}
      <span
        aria-hidden="true"
        className="hidden text-metadata tracking-widest text-ink-muted uppercase split:block"
      >
        {t(`task.${task}`)}
      </span>
    </>
  );

  if (onSelect && !locked) {
    return (
      <button
        type="button"
        onClick={() => onSelect(day)}
        aria-current={status === "today" ? "step" : undefined}
        {...pressProps}
        className={`${className} pressable hover:bg-ink/4`}
      >
        {rippleLayer}
        {content}
      </button>
    );
  }

  return (
    <div
      aria-current={status === "today" ? "step" : undefined}
      aria-disabled={locked || undefined}
      className={className}
    >
      {content}
    </div>
  );
}

"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

/** Above this many steps, segments get too thin on phones; draw a bar instead. */
export const MAX_SEGMENTS = 30;

type ProgressBarProps = {
  value: number;
  max: number;
  /** Visible label, also used as the accessible name. */
  label: string;
  /** Show "value / max" next to the label (hide it when the label already says where you are). */
  showCount?: boolean;
  className?: string;
};

/**
 * One segment per step (e.g. per sentence) up to MAX_SEGMENTS, otherwise a
 * continuous 4px bar. Accent fill on a line track, 300ms transitions.
 *
 * Motion (docs/design-system.md → 動態原則): a small accent dot rides the
 * front edge and hops each time progress moves forward; when every step is
 * done, a check mark draws itself next to the label. Nothing moves on the
 * first render (e.g. resuming at 5 / 12), and Reduce Motion turns it all off.
 */
export function ProgressBar({
  value,
  max,
  label,
  showCount = true,
  className = "",
}: ProgressBarProps) {
  const t = useTranslations("practice.progress");
  const format = useFormatter();
  const current = Math.min(Math.max(value, 0), max);
  const segmented = max > 0 && max <= MAX_SEGMENTS;
  const done = max > 0 && current === max;
  // Only animate changes made after the bar first appeared.
  const [initial] = useState(current);
  const moved = current !== initial;
  const percent = max > 0 ? (current / max) * 100 : 0;

  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-4 text-metadata tracking-widest text-ink-muted uppercase">
        <span className="flex items-center gap-2">
          {label}
          {done && (
            <svg
              aria-hidden="true"
              data-check=""
              viewBox="0 0 16 16"
              className="size-3.5 self-center text-success"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path
                d="M3 8.5l3 3 7-7"
                strokeDasharray={24}
                className={
                  moved ? "animate-check-draw motion-reduce:animate-none" : ""
                }
              />
            </svg>
          )}
        </span>
        {showCount && (
          <span className="tabular-nums">
            {t("count", {
              value: format.number(current),
              max: format.number(max),
            })}
          </span>
        )}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={current}
        data-mode={segmented ? "segmented" : "continuous"}
        data-done={done || undefined}
        className="relative flex h-1 gap-0.5"
      >
        {segmented ? (
          Array.from({ length: max }, (_, index) => (
            <span
              key={index}
              data-filled={index < current || undefined}
              className={`flex-1 transition-colors duration-(--ll-duration-progress) motion-reduce:transition-none ${
                index < current ? "bg-accent" : "bg-line"
              }`}
            />
          ))
        ) : (
          <span className="relative flex-1 bg-line">
            <span
              className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-(--ll-duration-progress) motion-reduce:transition-none"
              style={{ width: `${percent}%` }}
            />
          </span>
        )}
        {/* Leading dot. The key restarts the hop each time progress moves. */}
        <span
          key={current}
          aria-hidden="true"
          data-dot=""
          data-hop={moved || undefined}
          className={`absolute top-1/2 size-1.5 bg-accent transition-[left] duration-(--ll-duration-progress) motion-reduce:transition-none ${
            moved ? "animate-dot-hop motion-reduce:animate-none" : ""
          }`}
          style={{
            left: `${percent}%`,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
          }}
        />
      </div>
    </div>
  );
}

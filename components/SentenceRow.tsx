"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { usePress } from "./usePress";

export type SentenceStatus = "pending" | "current" | "done";

type SentenceRowProps = {
  /** Zero-based sentence index (shown as 01, 02, …). */
  index: number;
  status: SentenceStatus;
  /** English sentence. Can contain marked-up words (e.g. dictation results). */
  children?: ReactNode;
  /** Hide the text, e.g. during dictation before the user answers. */
  hidden?: boolean;
  /** Accuracy between 0 and 1, shown when done. */
  score?: number;
  /** Makes the whole row a button (e.g. jump to this sentence). */
  onSelect?: () => void;
};

const rowClassName =
  "relative grid w-full grid-cols-[2rem_1fr_auto] items-baseline gap-4 border-b border-line py-4 pr-2 pl-4 text-left";

// 2px accent bar on the left of the current sentence.
const currentClassName =
  "before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:bg-accent";

export function SentenceRow({
  index,
  status,
  children,
  hidden = false,
  score,
  onSelect,
}: SentenceRowProps) {
  const t = useTranslations("practice.sentence");
  const format = useFormatter();
  const { pressProps, rippleLayer } = usePress<HTMLButtonElement>({});

  const content = (
    <>
      <span
        aria-hidden="true"
        className="text-metadata text-ink-muted tabular-nums"
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <span>
        <span className="sr-only">{t("number", { n: index + 1 })} </span>
        {hidden ? (
          <>
            <span
              aria-hidden="true"
              className="text-sentence tracking-[0.3em] text-ink-muted"
            >
              ······
            </span>
            <span className="sr-only">{t("hidden")}</span>
          </>
        ) : (
          <span lang="en" className="text-sentence">
            {children}
          </span>
        )}
      </span>
      <span className="flex items-baseline gap-2 text-supporting whitespace-nowrap">
        {status === "done" && (
          <>
            <span aria-hidden="true" className="text-success">
              ✓
            </span>
            {score !== undefined && (
              <span className="text-ink-muted tabular-nums">
                {format.number(score, {
                  style: "percent",
                  maximumFractionDigits: 0,
                })}
              </span>
            )}
          </>
        )}
        {status === "current" && (
          <span aria-hidden="true" className="text-accent-ink">
            ▶
          </span>
        )}
        <span className="sr-only">{t(`status.${status}`)}</span>
      </span>
    </>
  );

  const className = `${rowClassName} ${status === "current" ? currentClassName : ""}`;
  const ariaCurrent = status === "current" ? ("step" as const) : undefined;

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-current={ariaCurrent}
        {...pressProps}
        className={`${className} pressable hover:bg-ink/4`}
      >
        {rippleLayer}
        {content}
      </button>
    );
  }

  return (
    <div aria-current={ariaCurrent} className={className}>
      {content}
    </div>
  );
}

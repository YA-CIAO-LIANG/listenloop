"use client";

import { useTranslations } from "next-intl";
import { PRACTICE_RINGS, ringLevel } from "@/lib/practice-rings";
import { glowStyle } from "./practice-rings";

/**
 * The words for a day's practice-time level (D217): "Glow 2 · 30 min or
 * more", or "Under 15 min" without a glow. The same text goes into each
 * day's accessible name, so a screen reader hears what the glow shows.
 */
export function useRingText() {
  const t = useTranslations("calendar");
  return (minutes: number) => {
    const level = ringLevel(minutes);
    if (level === 0) {
      return t("ringNone", { n: PRACTICE_RINGS[0].minMinutes });
    }
    const { minMinutes } = PRACTICE_RINGS[level - 1];
    return t("ringLevel", {
      level,
      threshold:
        minMinutes % 60 === 0
          ? t("atLeastHours", { n: minMinutes / 60 })
          : t("atLeastMinutes", { n: minMinutes }),
    });
  };
}

/**
 * The glow a day wears on the calendar, drawn small like the legend's,
 * with its level in words (D217): in the tooltip and the chosen day's
 * details of both calendars. Inside data-area="writing" the glow is teal.
 */
export function RingLevel({ minutes }: { minutes: number }) {
  const ringText = useRingText();
  const level = ringLevel(minutes);
  return (
    <p data-testid="ring-level" className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        data-ring-level={level}
        style={level !== 0 ? glowStyle(level, 0.6) : undefined}
        className="inline-block size-2.5 shrink-0 rounded-full border border-line"
      />
      <span className="text-ink-muted">{ringText(minutes)}</span>
    </p>
  );
}

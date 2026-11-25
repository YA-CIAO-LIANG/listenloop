import { getFormatter, getTranslations } from "next-intl/server";
import type { WeekAllowance } from "@/auth/creation-quota";
import { secondsToWords, WORDS_PER_MINUTE } from "@/lib/units";

/**
 * The free plan's week (D143): what's left of its words (D209) and when
 * they come back, in the learner's own time zone (D139).
 */
export async function WeekAllowanceNote({ week }: { week: WeekAllowance }) {
  const [t, format] = await Promise.all([
    getTranslations("plans"),
    getFormatter(),
  ]);
  const reset = format.dateTime(new Date(week.resetsAt), {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return (
    <p
      data-testid="week-allowance"
      className="rounded-base border border-line surface-card p-4 text-supporting"
    >
      {week.leftSeconds === 0
        ? t("weekUsed", { total: week.words, reset })
        : t("week", {
            left: Math.min(week.words, secondsToWords(week.leftSeconds)),
            minutes: Math.round((week.words / WORDS_PER_MINUTE) * 10) / 10,
            total: week.words,
            reset,
          })}
    </p>
  );
}

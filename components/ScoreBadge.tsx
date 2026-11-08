import { useFormatter, useTranslations } from "next-intl";

type ScoreBadgeProps = {
  /** Accuracy between 0 and 1. */
  score: number;
  /** The week passed (Day 7, by the practice's rules, D92). */
  passed?: boolean;
  className?: string;
};

/**
 * Large serif percentage. A passed week turns it success green and adds a
 * "Passed" label, so the result never relies on color alone.
 */
export function ScoreBadge({
  score,
  passed = false,
  className = "",
}: ScoreBadgeProps) {
  const t = useTranslations("practice.score");
  const format = useFormatter();

  return (
    <div className={className} data-passed={passed || undefined}>
      <span
        className={`block font-display text-h1 tabular-nums ${
          passed ? "text-success" : "text-ink"
        }`}
      >
        {format.number(score, { style: "percent", maximumFractionDigits: 0 })}
      </span>
      <span className="mt-1 block text-metadata tracking-widest text-ink-muted uppercase">
        {t("accuracy")}
        {passed && (
          <>
            {" · "}
            <span className="text-success">{t("passed")}</span>
          </>
        )}
      </span>
    </div>
  );
}

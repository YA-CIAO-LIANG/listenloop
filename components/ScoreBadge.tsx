import { useFormatter, useTranslations } from "next-intl";
import { isPassingScore } from "@/lib/cycle";

type ScoreBadgeProps = {
  /** Accuracy between 0 and 1. */
  score: number;
  className?: string;
};

/**
 * Large serif percentage. A passing score turns success green and adds a
 * "Passed" label, so the result never relies on color alone.
 */
export function ScoreBadge({ score, className = "" }: ScoreBadgeProps) {
  const t = useTranslations("practice.score");
  const format = useFormatter();
  const passed = isPassingScore(score);

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

import { useFormatter, useTranslations } from "next-intl";

/** Above this many steps, segments get too thin on phones; draw a bar instead. */
export const MAX_SEGMENTS = 30;

type ProgressBarProps = {
  value: number;
  max: number;
  /** Visible label, also used as the accessible name. */
  label: string;
  className?: string;
};

/**
 * One segment per step (e.g. per sentence) up to MAX_SEGMENTS, otherwise a
 * continuous 4px bar. Accent fill on a line track, 300ms transitions.
 */
export function ProgressBar({
  value,
  max,
  label,
  className = "",
}: ProgressBarProps) {
  const t = useTranslations("practice.progress");
  const format = useFormatter();
  const current = Math.min(Math.max(value, 0), max);
  const segmented = max > 0 && max <= MAX_SEGMENTS;

  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-4 text-metadata tracking-widest text-ink-muted uppercase">
        <span>{label}</span>
        <span className="tabular-nums">
          {t("count", {
            value: format.number(current),
            max: format.number(max),
          })}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={current}
        data-mode={segmented ? "segmented" : "continuous"}
        className="flex h-1 gap-0.5"
      >
        {segmented ? (
          Array.from({ length: max }, (_, index) => (
            <span
              key={index}
              data-filled={index < current || undefined}
              className={`flex-1 transition-colors duration-(--ll-duration-progress) ${
                index < current ? "bg-accent" : "bg-line"
              }`}
            />
          ))
        ) : (
          <span className="relative flex-1 bg-line">
            <span
              className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-(--ll-duration-progress)"
              style={{ width: `${max > 0 ? (current / max) * 100 : 0}%` }}
            />
          </span>
        )}
      </div>
    </div>
  );
}

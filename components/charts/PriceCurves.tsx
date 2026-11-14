import type { CurvePoint } from "@/lib/price-survey";

const LINES = [
  { key: "tooCheap", className: "stroke-ink-muted", dash: "4 3" },
  { key: "bargain", className: "stroke-success", dash: "" },
  { key: "expensive", className: "stroke-accent", dash: "" },
  { key: "tooExpensive", className: "stroke-ink", dash: "1 3" },
] as const;

/**
 * The four Van Westendorp curves (D174): share of answers (0–100%) at
 * each price. Lines differ by dash as well as color, with a legend; the
 * figures that matter are in the table next to it, so the chart itself
 * is hidden from screen readers.
 */
export function PriceCurves({
  points,
  labels,
  formatPrice,
}: {
  points: readonly CurvePoint[];
  labels: Record<(typeof LINES)[number]["key"], string>;
  formatPrice: (price: number) => string;
}) {
  if (points.length < 2) return null;
  const lo = points[0].price;
  const hi = points[points.length - 1].price;
  const x = (price: number) =>
    hi === lo ? 50 : ((price - lo) / (hi - lo)) * 100;
  const path = (key: (typeof LINES)[number]["key"]) =>
    points
      .map(
        (p, i) => `${i === 0 ? "M" : "L"}${x(p.price)},${100 - p[key] * 100}`,
      )
      .join(" ");
  return (
    <div aria-hidden="true" className="space-y-3">
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-metadata text-ink-muted">
        {LINES.map(({ key, className, dash }) => (
          <span key={key} className="inline-flex items-center gap-1">
            <svg width="20" height="6" viewBox="0 0 20 6">
              <line
                x1="0"
                y1="3"
                x2="20"
                y2="3"
                strokeWidth="2"
                strokeDasharray={dash || undefined}
                className={className}
              />
            </svg>
            {labels[key]}
          </span>
        ))}
      </p>
      <div className="grid grid-cols-[auto_1fr] gap-x-2">
        <div className="flex h-48 flex-col justify-between text-right text-metadata text-ink-muted tabular-nums">
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>
        <div className="relative h-48 border-b border-l border-line">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
          >
            {LINES.map(({ key, className, dash }) => (
              <path
                key={key}
                d={path(key)}
                fill="none"
                strokeWidth="2"
                strokeDasharray={dash || undefined}
                vectorEffect="non-scaling-stroke"
                className={className}
              />
            ))}
          </svg>
        </div>
        <span />
        <div className="flex justify-between text-metadata text-ink-muted tabular-nums">
          <span>{formatPrice(lo)}</span>
          <span>{formatPrice((lo + hi) / 2)}</span>
          <span>{formatPrice(hi)}</span>
        </div>
      </div>
    </div>
  );
}

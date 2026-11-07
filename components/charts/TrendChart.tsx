"use client";

/**
 * Accuracy over time (D75): the weighted score as the main line in the
 * accent color, the raw score as a dashed, muted reference, on 0–100%
 * with the 80% pass mark. Lines are SVG stretched to the box (strokes
 * stay 2px); dots and labels are HTML, so text keeps its size on phones.
 * Each dot's values show on hover (title).
 */
export function TrendChart({
  points,
  format,
  labels,
}: {
  points: readonly { weighted: number; raw: number; tooltip: string }[];
  format: (value: number) => string;
  labels: {
    weighted: string;
    raw: string;
    pass: string;
    first: string;
    last: string;
  };
}) {
  const n = points.length;
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const line = (key: "weighted" | "raw") =>
    points
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${100 - p[key] * 100}`)
      .join(" ");
  const sameLines = points.every((p) => Math.abs(p.weighted - p.raw) < 1e-9);

  return (
    <div aria-hidden="true" className="space-y-3">
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-metadata text-ink-muted">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-4 border-t-2 border-accent" />
          {labels.weighted}
        </span>
        {!sameLines && (
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-4 border-t-2 border-dashed border-ink-muted" />
            {labels.raw}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-4 border-t border-dashed border-ink" />
          {labels.pass}
        </span>
      </p>
      <div className="grid grid-cols-[auto_1fr] gap-x-2">
        <div className="flex h-40 flex-col justify-between text-right text-metadata text-ink-muted tabular-nums">
          <span>{format(1)}</span>
          <span>{format(0.5)}</span>
          <span>{format(0)}</span>
        </div>
        <div className="relative h-40">
          {[0, 50, 100].map((p) => (
            <div
              key={p}
              className="absolute inset-x-0 border-t border-line"
              style={{ bottom: `${p}%` }}
            />
          ))}
          <div
            className="absolute inset-x-0 border-t border-dashed border-ink"
            style={{ bottom: "80%" }}
          />
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
          >
            {!sameLines && (
              <path
                d={line("raw")}
                fill="none"
                strokeWidth={2}
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
                className="stroke-ink-muted"
              />
            )}
            <path
              d={line("weighted")}
              fill="none"
              strokeWidth={2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="stroke-accent"
            />
          </svg>
          {points.map((p, i) => (
            <span
              key={i}
              title={p.tooltip}
              className="absolute -mb-3 -ml-3 flex size-6 items-center justify-center"
              style={{ left: `${x(i)}%`, bottom: `${p.weighted * 100}%` }}
            >
              <span className="size-2.5 rounded-full border-2 border-surface bg-accent" />
            </span>
          ))}
        </div>
        <span />
        <div className="mt-1 flex justify-between text-metadata text-ink-muted">
          <span>{labels.first}</span>
          {n > 1 && <span>{labels.last}</span>}
        </div>
      </div>
    </div>
  );
}

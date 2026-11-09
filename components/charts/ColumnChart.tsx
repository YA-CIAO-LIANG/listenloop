"use client";

/**
 * Vertical bars over time (D75), drawn with HTML so labels keep the
 * design system's sizes on any screen: one series in the accent color,
 * 4px rounded tops on the baseline, a 2px gap between bars, recessive
 * grid lines, the largest value labeled, every value on hover (title).
 */
export function ColumnChart({
  data,
  format,
  tickEvery = 1,
}: {
  data: readonly { label: string; value: number; tooltip: string }[];
  /** Axis and label text for a value. */
  format: (value: number) => string;
  /** Show every n-th x label (dense months). */
  tickEvery?: number;
}) {
  const nice = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const peak = data.reduce(
    (best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best),
    0,
  );
  return (
    <div aria-hidden="true" className="grid grid-cols-[auto_1fr] gap-x-2">
      <div className="flex h-40 flex-col justify-between text-right text-metadata text-ink-muted tabular-nums">
        <span>{format(nice)}</span>
        <span>{format(nice / 2)}</span>
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
        <div className="absolute inset-0 flex items-end gap-0.5">
          {data.map((d, i) => (
            <div
              key={d.label}
              title={d.tooltip}
              className="group relative flex h-full flex-1 items-end"
            >
              {d.value > 0 && (
                <div
                  className="w-full rounded-t-base bg-accent group-hover:opacity-80"
                  style={{ height: `${(d.value / nice) * 100}%` }}
                />
              )}
              {i === peak && d.value > 0 && (
                <span
                  className="absolute inset-x-0 text-center text-metadata text-ink tabular-nums"
                  style={{ bottom: `calc(${(d.value / nice) * 100}% + 2px)` }}
                >
                  {format(d.value)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      <span />
      <div className="mt-1 flex gap-0.5 text-metadata text-ink-muted">
        {data.map((d, i) => (
          <span key={d.label} className="flex-1 text-center whitespace-nowrap">
            {i % tickEvery === 0 ? d.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A round number at or above `max` for the axis (2, 4, 6, 8, 10, 20, 50…). */
export function niceMax(max: number): number {
  const step = 10 ** Math.floor(Math.log10(max));
  // Below 10, only even tops: the middle line's label is then a whole
  // number (a top of 1 or 5 would label it "1" or "3" after rounding).
  const multiples = step === 1 ? [2, 4, 6, 8, 10] : [1, 2, 5, 10];
  for (const m of multiples) if (m * step >= max) return m * step;
  return 10 * step;
}

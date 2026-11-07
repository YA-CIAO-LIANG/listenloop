"use client";

/**
 * Before and after for each material (D75): Day 1 as the muted
 * reference bar, Day 7 in the accent color below it, each with its
 * value written out, on a 0–100% scale with the 80% mark.
 */
export function PairedBars({
  data,
  format,
  labels,
}: {
  data: readonly { label: string; before: number; after: number }[];
  format: (value: number) => string;
  labels: { before: string; after: string; pass: string };
}) {
  return (
    <div aria-hidden="true" className="space-y-4">
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-metadata text-ink-muted">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-base bg-ink-muted/50" />
          {labels.before}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded-base bg-accent" />
          {labels.after}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 border-l border-dashed border-ink" />
          {labels.pass}
        </span>
      </p>
      <ul className="space-y-4">
        {data.map((d) => (
          <li key={d.label} className="space-y-1">
            <p className="text-supporting">{d.label}</p>
            {(
              [
                [d.before, "bg-ink-muted/50", labels.before],
                [d.after, "bg-accent", labels.after],
              ] as const
            ).map(([value, color, name]) => (
              <div
                key={name}
                className="grid grid-cols-[1fr_3.5rem] items-center gap-2"
              >
                <span className="relative h-3 rounded-r-base bg-band">
                  <span
                    className={`block h-full rounded-r-base ${color}`}
                    style={{ width: `${value * 100}%` }}
                  />
                  <span className="absolute inset-y-[-2px] left-[80%] border-l border-dashed border-ink" />
                </span>
                <span className="text-right text-metadata text-ink-muted tabular-nums">
                  {format(value)}
                </span>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

"use client";

/**
 * Horizontal bars with the label on the left and the value on the right
 * (D75): misheard words, categories, levels. One series in the accent
 * color; the value is always written, so the bar's length is never the
 * only way to read it.
 */
export function BarList({
  data,
  format = String,
  labelLang,
}: {
  data: readonly { label: string; value: number }[];
  format?: (value: number) => string;
  /** E.g. "en" for English words. */
  labelLang?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul aria-hidden="true" className="space-y-2">
      {data.map((d) => (
        <li
          key={d.label}
          className="grid grid-cols-[minmax(5rem,9rem)_1fr_auto] items-center gap-3 text-supporting"
        >
          <span lang={labelLang} className="truncate">
            {d.label}
          </span>
          <span className="h-3 rounded-r-base bg-band">
            <span
              className="block h-full rounded-r-base bg-accent"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </span>
          <span className="text-ink-muted tabular-nums">{format(d.value)}</span>
        </li>
      ))}
    </ul>
  );
}

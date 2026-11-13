"use client";

import { useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";

export type TableColumn = { label: string; numeric?: boolean };

/**
 * One chart on the stats page (D75): a titled figure whose one-line
 * summary is what screen readers hear for the picture, then a "data
 * table" disclosure with every value, so nothing is shown only as color
 * or shape.
 */
export function ChartFrame({
  title,
  summary,
  controls,
  columns,
  rows,
  empty,
  children,
}: {
  title: string;
  /** One sentence on what the chart shows; read for the picture. */
  summary: string;
  /** E.g. the week / month toggle, beside the title. */
  controls?: ReactNode;
  columns: readonly TableColumn[];
  rows: readonly (readonly (string | number)[])[];
  /** Shown instead of the chart when there's nothing to draw. */
  empty?: string;
  children: ReactNode;
}) {
  const t = useTranslations("stats");
  const ids = useId();
  return (
    <figure
      aria-labelledby={`${ids}-title`}
      className="space-y-4 rounded-base border border-line surface-card p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id={`${ids}-title`} className="font-display text-h3">
          {title}
        </h2>
        {controls}
      </div>
      {rows.length === 0 && empty ? (
        <p className="text-supporting text-ink-muted">{empty}</p>
      ) : (
        <>
          <div role="img" aria-label={summary}>
            {children}
          </div>
          <figcaption className="text-supporting text-ink-muted">
            {summary}
          </figcaption>
          <details className="text-supporting">
            <summary className="tap cursor-pointer text-accent-ink underline-offset-4 hover:underline">
              {t("table")}
            </summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-line text-left text-ink-muted">
                    {columns.map((column) => (
                      <th
                        key={column.label}
                        scope="col"
                        className={`py-2 pr-4 font-normal ${column.numeric ? "text-right" : ""}`}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-b border-line">
                      {row.map((cell, k) => (
                        <td
                          key={k}
                          className={`py-2 pr-4 ${columns[k]?.numeric ? "text-right tabular-nums" : ""}`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </figure>
  );
}

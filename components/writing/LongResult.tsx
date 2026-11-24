"use client";

import { useTranslations } from "next-intl";
import { essayMetrics } from "@/lib/writing/metrics";
import {
  day30Of,
  essayPercent,
  type WritingProgress,
} from "@/lib/writing/progress";

/**
 * Day 30's comparison (D203, learning-science.md §14): days 1, 7, and 30
 * side by side, the score (when there is one) and the rule-based
 * measures, so the long-term change shows, not only the week's.
 */
export function LongResult({ progress }: { progress: WritingProgress }) {
  const t = useTranslations("writing.long");
  const days = [
    { label: t("day1"), record: progress.days[1] },
    { label: t("day7"), record: progress.days[7] },
    { label: t("day30"), record: day30Of(progress) },
  ];
  const metrics = days.map((d) => essayMetrics(d.record?.essay ?? ""));
  const scores = days.map((d) => essayPercent(d.record));
  const rows = [
    {
      name: t("score"),
      values: scores.map((s) => (s === null ? "—" : `${s}`)),
    },
    { name: t("words"), values: metrics.map((m) => `${m.words}`) },
    {
      name: t("sentenceWords"),
      values: metrics.map((m) => `${m.sentenceWords}`),
    },
    { name: t("diversity"), values: metrics.map((m) => `${m.diversity}`) },
  ];
  const first = scores[0];
  const last = scores[2];
  return (
    <section aria-labelledby="long-result" className="flex flex-col gap-4">
      <h2 id="long-result" className="font-display text-h2">
        {t("title")}
      </h2>
      <p>
        {first !== null && last !== null
          ? t("change", {
              change: last - first > 0 ? `+${last - first}` : `${last - first}`,
            })
          : t("noScore")}
      </p>
      <table className="w-full max-w-reading text-supporting">
        <caption className="mb-2 text-left font-medium">{t("table")}</caption>
        <thead>
          <tr>
            <th scope="col" className="border-b border-line py-1 text-left">
              <span className="sr-only">{t("measure")}</span>
            </th>
            {days.map((d) => (
              <th
                key={d.label}
                scope="col"
                className="border-b border-line py-1 text-right"
              >
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <th
                scope="row"
                className="border-b border-line py-1 text-left font-normal"
              >
                {row.name}
              </th>
              {row.values.map((v, i) => (
                <td
                  key={i}
                  className="border-b border-line py-1 text-right tabular-nums"
                >
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-supporting text-ink-muted">{t("note")}</p>
      <div className="grid gap-4 split:grid-cols-3">
        {days.map(({ label, record }) => (
          <div key={label} className="flex flex-col gap-2">
            <h3 className="font-medium">{label}</h3>
            <div
              lang="en"
              className="rounded-base border border-line bg-surface p-3 text-supporting whitespace-pre-wrap"
            >
              {record?.essay ?? "—"}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

import { useTranslations } from "next-intl";
import type { WritingPrompt } from "@/lib/writing/types";

/**
 * The task as set (English), its Chinese explanation, a chart's data as
 * a table, the length and time, and what the scoring looks at (D187).
 */
export function PromptTask({ prompt }: { prompt: WritingPrompt }) {
  const t = useTranslations("writing");
  return (
    <div className="flex flex-col gap-4">
      <p lang="en" className="max-w-reading text-body whitespace-pre-line">
        {prompt.task}
      </p>
      {prompt.taskZh && (
        <p className="max-w-reading text-supporting text-ink-muted">
          {prompt.taskZh}
        </p>
      )}
      {prompt.chart && (
        <div className="overflow-x-auto">
          <table
            className="min-w-full border-collapse text-supporting"
            lang="en"
          >
            <caption className="mb-2 text-left font-medium">
              {prompt.chart.title}
            </caption>
            <thead>
              <tr>
                {prompt.chart.columns.map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="border-b border-line px-2 py-1 text-left"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prompt.chart.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) =>
                    j === 0 ? (
                      <th
                        key={j}
                        scope="row"
                        className="border-b border-line px-2 py-1 text-left font-normal"
                      >
                        {cell}
                      </th>
                    ) : (
                      <td
                        key={j}
                        className="border-b border-line px-2 py-1 tabular-nums"
                      >
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-supporting text-ink-muted tabular-nums">
        {t("library.words", prompt.words)} ·{" "}
        {t("library.time", { minutes: prompt.minutes })}
      </p>
      {prompt.focus.length > 0 && (
        <div>
          <h3 className="text-supporting font-medium">{t("prompt.focus")}</h3>
          <ul className="mt-1 list-disc pl-5 text-supporting">
            {prompt.focus.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

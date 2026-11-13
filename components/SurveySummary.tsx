import { getFormatter, getTranslations } from "next-intl/server";
import type { SurveyRow } from "@/auth/surveys";
import type { NpsSummary } from "@/lib/survey";
import { StatTile } from "./StatTile";

/**
 * The Day 7 survey on admin pages (D164): Net Promoter Score, the split,
 * the average, and the latest comments (with the account number).
 */
export async function SurveySummary({
  rows,
  summary,
  numbers,
  comments = 20,
}: {
  rows: SurveyRow[];
  summary: NpsSummary;
  numbers: Map<string, string>;
  comments?: number;
}) {
  const [t, format] = await Promise.all([
    getTranslations("admin.survey"),
    getFormatter(),
  ]);
  const withComment = rows.filter((r) => r.comment).slice(0, comments);
  return (
    <section aria-labelledby="survey-title" className="space-y-4">
      <h2 id="survey-title" className="font-display text-h2">
        {t("title")}
      </h2>
      <p className="max-w-reading text-supporting text-ink-muted">
        {t("intro")}
      </p>
      {summary.count === 0 ? (
        <p className="text-ink-muted">{t("none")}</p>
      ) : (
        <>
          <dl className="grid gap-3 split:grid-cols-4">
            <StatTile
              label={t("nps")}
              value={summary.nps ?? "—"}
              note={t("npsNote")}
            />
            <StatTile label={t("count")} value={summary.count} />
            <StatTile label={t("average")} value={summary.average ?? "—"} />
            <StatTile
              label={t("split")}
              value={`${summary.promoters} / ${summary.passives} / ${summary.detractors}`}
              note={t("splitNote")}
            />
          </dl>
          {withComment.length > 0 && (
            <ul className="max-w-practice divide-y divide-line border-y border-line">
              {withComment.map((row) => (
                <li key={row.id} className="space-y-1 py-3">
                  <p className="text-supporting text-ink-muted">
                    {[
                      format.dateTime(new Date(row.createdAt), {
                        dateStyle: "medium",
                      }),
                      t("score", { score: row.score }),
                      t("material", { id: row.videoId, week: row.week }),
                      numbers.get(row.userId),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="whitespace-pre-wrap">{row.comment}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

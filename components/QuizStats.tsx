"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { quizTrend, wordsMastered } from "@/lib/analytics";
import { loadQuizAttempts, type QuizAttempt } from "@/lib/quiz-records";
import { loadBrowserSupabase } from "@/lib/supabase/browser";
import { ChartFrame } from "./charts/ChartFrame";
import { TrendChart } from "./charts/TrendChart";
import { StatTile } from "./StatTile";

const loadOwnAttempts = async () =>
  loadQuizAttempts(await loadBrowserSupabase());

/**
 * The vocabulary quiz on the stats page (D136): how many, the average,
 * and the words mastered for everyone; the accuracy trend with the full
 * stats (Plus and Pro, like the other trends).
 */
export function QuizStats({
  full,
  titleOf,
  load = loadOwnAttempts,
}: {
  full: boolean;
  titleOf: (id: string) => string;
  /** Injected in tests. */
  load?: () => Promise<QuizAttempt[]>;
}) {
  const t = useTranslations("stats");
  const tAll = useTranslations();
  const format = useFormatter();
  const [attempts, setAttempts] = useState<QuizAttempt[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    load()
      .catch(() => [])
      .then((list) => {
        if (!cancelled) setAttempts(list);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (!attempts) return null;
  const percent = (n: number) =>
    format.number(n, { style: "percent", maximumFractionDigits: 0 });
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { month: "numeric", day: "numeric" });
  const trend = quizTrend(attempts);
  const average =
    trend.length > 0
      ? trend.reduce((sum, p) => sum + p.accuracy, 0) / trend.length
      : null;

  return (
    <section aria-labelledby="quiz-stats" className="space-y-4">
      <h2 id="quiz-stats" className="font-display text-h3">
        {t("quizTitle")}
      </h2>
      <dl className="grid grid-cols-2 gap-4 wide:grid-cols-3">
        <StatTile label={t("quizCount")} value={attempts.length} />
        <StatTile
          label={t("quizAverage")}
          value={average === null ? "—" : percent(average)}
        />
        <StatTile
          label={t("quizMastered")}
          value={wordsMastered(attempts)}
          note={t("quizMasteredNote")}
        />
      </dl>
      {attempts.length === 0 && (
        <p className="text-supporting text-ink-muted">{t("quizEmpty")}</p>
      )}
      {full && trend.length > 0 && (
        <ChartFrame
          title={t("quizTrendTitle")}
          summary={t("quizTrendSummary", {
            count: trend.length,
            first: percent(trend[0].accuracy),
            last: percent(trend.at(-1)!.accuracy),
          })}
          empty={t("quizEmpty")}
          columns={[
            { label: t("date") },
            { label: t("material") },
            { label: t("dayColumn") },
            { label: t("quizAccuracy"), numeric: true },
          ]}
          rows={trend.map((p) => [
            date(p.takenAt),
            titleOf(p.videoId),
            tAll("common.dayN", { day: p.day }),
            percent(p.accuracy),
          ])}
        >
          <TrendChart
            points={trend.map((p) => ({
              weighted: p.accuracy,
              raw: p.accuracy,
              tooltip: `${date(p.takenAt)} · ${titleOf(p.videoId)} · ${percent(p.accuracy)}`,
            }))}
            format={percent}
            labels={{
              weighted: t("quizAccuracy"),
              raw: t("quizAccuracy"),
              pass: t("quizTarget"),
              first: date(trend[0].takenAt),
              last: date(trend.at(-1)!.takenAt),
            }}
          />
        </ChartFrame>
      )}
    </section>
  );
}

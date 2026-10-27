"use client";

import { useFormatter, useTranslations } from "next-intl";
import { isDevTestMode } from "@/lib/config";
import { canStartNextWeek, weekComparison } from "@/lib/cycle";
import { toLocalDate } from "@/lib/dates";
import type { Progress } from "@/lib/progress";
import { wordDiff } from "@/lib/scoring/word-diff";
import type { ProgressStore } from "@/lib/storage/progress-store";
import type { Video } from "@/lib/videos";
import { ButtonLink } from "./ButtonLink";
import { RewardGainedNote } from "./RewardBadge";
import { ScoreBadge } from "./ScoreBadge";
import { StartNextWeekButton } from "./StartNextWeekButton";
import { WordDiffView } from "./WordDiffView";

type WeekResultProps = {
  video: Video;
  /** Progress with Day 7 done and the week settled. */
  progress: Progress;
  store: ProgressStore;
};

/**
 * The official Day 7 completion screen: Day 1 → Day 7 accuracy with the
 * change, the verdict (passed, or another week from tomorrow), each
 * sentence compared, and earlier weeks.
 */
export function WeekResult({ video, progress, store }: WeekResultProps) {
  const t = useTranslations("week");
  const tCycle = useTranslations("cycle");
  const tHandout = useTranslations("handout");
  const format = useFormatter();
  const comparison = weekComparison(video.sentences, progress);
  if (!comparison) return null;

  const percent = (value: number) =>
    format.number(value, { style: "percent", maximumFractionDigits: 0 });
  // Compare the rounded percentages learners see, so the numbers add up.
  const points = (from: number, to: number) =>
    Math.round(to * 100) - Math.round(from * 100);
  const change = points(comparison.day1, comparison.day7);
  const passed = progress.status === "passed";
  const canStart = canStartNextWeek(progress, toLocalDate(new Date()), {
    ignoreDates: isDevTestMode(),
  });
  const earlierWeeks = progress.history.slice(0, -1);

  return (
    <div className="practice-column mt-8 space-y-12">
      <div className="space-y-6">
        <p className="text-supporting text-success">
          <span aria-hidden="true">✓ </span>
          {tCycle("todayDone")}
        </p>
        <RewardGainedNote />
        <h2 className="font-display text-h2">
          {t("resultTitle", { week: progress.week })}
        </h2>

        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <p className="text-metadata tracking-widest text-ink-muted uppercase">
              {t("day1")}
            </p>
            <p className="font-display text-h1 text-ink-muted tabular-nums">
              {percent(comparison.day1)}
            </p>
          </div>
          <span aria-hidden="true" className="pb-3 font-display text-h2">
            →
          </span>
          <div>
            <p className="text-metadata tracking-widest text-ink-muted uppercase">
              {t("day7")}
            </p>
            <ScoreBadge score={comparison.day7} />
          </div>
        </div>
        <p
          className={`text-supporting ${change > 0 ? "text-success" : "text-ink-muted"}`}
        >
          {change > 0
            ? t("improved", { points: change })
            : change < 0
              ? t("declined", { points: -change })
              : t("same")}
        </p>

        <p className="font-display text-h3">
          {passed ? t("passedMessage") : t("repeatMessage")}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {passed ? (
            <>
              <ButtonLink href="/" variant="primary" arrow>
                {t("chooseNext")}
              </ButtonLink>
              <ButtonLink
                href={`/videos/${video.id}/handout`}
                variant="secondary"
              >
                {tHandout("open")}
              </ButtonLink>
            </>
          ) : canStart ? (
            <StartNextWeekButton progress={progress} store={store} />
          ) : (
            <p className="text-ink-muted">
              {t("nextTomorrow", { week: progress.week + 1 })}
            </p>
          )}
          <ButtonLink href={`/videos/${video.id}`} variant="ghost">
            {tCycle("backToVideo")}
          </ButtonLink>
        </div>
      </div>

      <section>
        <h2 className="mb-6 font-display text-h2">{t("compareTitle")}</h2>
        <ol className="border-t border-line">
          {video.sentences.map((sentence, index) => {
            const scores = comparison.sentences[index];
            const improved = points(scores.day1, scores.day7) > 0;
            return (
              <li
                key={sentence.i}
                className="grid gap-3 border-b border-line py-6 split:grid-cols-[2rem_1fr_auto]"
              >
                <span className="text-metadata text-ink-muted tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <WordDiffView
                  diff={wordDiff(
                    sentence.en,
                    progress.days[7]?.answers?.[index] ?? "",
                  )}
                />
                <span className="text-supporting whitespace-nowrap text-ink-muted tabular-nums">
                  {t("sentenceCompare", {
                    day1: percent(scores.day1),
                    day7: percent(scores.day7),
                  })}
                  {improved && (
                    <>
                      <span aria-hidden="true" className="text-success">
                        {" "}
                        ↑
                      </span>
                      <span className="sr-only">{t("improvedSr")}</span>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {earlierWeeks.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-h3">{t("history")}</h2>
          <ul className="space-y-1 text-supporting text-ink-muted">
            {earlierWeeks.map((week) => (
              <li key={week.week}>
                {t("historyRow", {
                  week: week.week,
                  day1: percent(week.day1Score),
                  day7: percent(week.day7Score),
                  result: week.passed ? t("passed") : t("notPassed"),
                })}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toLocalDate } from "@/lib/dates";
import {
  fixItems,
  planDrills,
  rebuildParagraph,
  reorderParagraph,
  type DrillDayNumber,
} from "@/lib/writing/drills";
import { weaknesses } from "@/lib/writing/feedback";
import {
  writingTimeId,
  type DrillResult,
  type ExerciseKind,
} from "@/lib/writing/progress";
import type { WritingPrompt } from "@/lib/writing/types";
import { ButtonLink } from "../ButtonLink";
import { Card } from "../Card";
import { usePracticeTimer } from "../usePracticeTimer";
import {
  CombineDrill,
  FixDrill,
  ListenDrill,
  ParaphraseDrill,
  PatternDrill,
  RebuildDrill,
  ReorderDrill,
  type DrillDone,
} from "./Drills";
import { useWritingData, useWritingProgress } from "./WritingProvider";
import { WritingWorkspace } from "./WritingWorkspace";

/** The listening video for the listen-then-write drill. */
const DEFAULT_LISTEN_VIDEO = "sintel";

/**
 * Days 2–6 (D187): the day's one or two drills, chosen from Day 1's
 * weaknesses and mixed across days (lib/writing/drills.ts), one after
 * the other, each checked at once. 10–15 minutes.
 */
export function DrillDay({
  prompt,
  day,
}: {
  prompt: WritingPrompt;
  day: DrillDayNumber;
}) {
  const t = useTranslations("writing");
  const progress = useWritingProgress(prompt.id);
  const { saveProgress } = useWritingData();
  const record = progress?.days[day];
  const [results, setResults] = useState<DrillResult[]>([]);
  usePracticeTimer(writingTimeId(prompt.id), false, {
    active: Boolean(progress) && !record?.done,
  });
  if (!progress) return null;
  const day1 = progress.days[1];
  const weak = day1?.feedback
    ? weaknesses(day1.feedback)
    : (day1?.self?.weak ?? []);
  const fixes = fixItems(day1?.feedback);
  const plan = planDrills(weak, fixes.length > 0)[day];
  const offset = day - 2;

  if (record?.done) {
    return (
      <div className="flex flex-col gap-4">
        <Card role="status" className="flex flex-col gap-2">
          <p className="font-medium">{t("drills.dayDone")}</p>
          <ul className="text-supporting">
            {record.drills.map((d, i) => (
              <li key={i}>
                {d.correct ? "✓" : "…"} {t(`drills.kinds.${d.kind}.name`)}
              </li>
            ))}
          </ul>
        </Card>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/writing/notebook" variant="secondary" size="sm">
            {t("notebook.title")}
          </ButtonLink>
          <ButtonLink href={`/writing/${prompt.id}`} variant="ghost" size="sm">
            {t("essay.toOverview")}
          </ButtonLink>
        </div>
      </div>
    );
  }

  const kind: ExerciseKind | undefined = plan[results.length];
  const done: DrillDone = (correct) => {
    const next = [
      ...results,
      { kind: plan[results.length], done: true, correct },
    ];
    setResults(next);
    if (next.length === plan.length) {
      saveProgress({
        ...progress,
        days: {
          ...progress.days,
          [day]: { done: true, date: toLocalDate(new Date()), drills: next },
        },
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const pick = <T,>(list: readonly T[]) =>
    list[offset % Math.max(1, list.length)];
  const drill = (() => {
    switch (kind) {
      case "fix":
        return (
          <FixDrill items={fixes} essay={day1?.essay ?? ""} onDone={done} />
        );
      case "pattern":
        return <PatternDrill pattern={pick(prompt.patterns)} onDone={done} />;
      case "combine":
        return <CombineDrill item={pick(prompt.combine)} onDone={done} />;
      case "paraphrase":
        return <ParaphraseDrill item={pick(prompt.paraphrase)} onDone={done} />;
      case "reorder":
        return (
          <ReorderDrill
            sentences={reorderParagraph(prompt)}
            seed={`${prompt.id}:${day}`}
            onDone={done}
          />
        );
      case "rebuild":
        return (
          <RebuildDrill paragraph={rebuildParagraph(prompt)} onDone={done} />
        );
      case "listen":
        return (
          <ListenDrill
            videoId={prompt.listenVideo ?? DEFAULT_LISTEN_VIDEO}
            onDone={done}
          />
        );
      default:
        return null;
    }
  })();

  const steps = (
    <ol className="flex flex-wrap gap-2" aria-label={t("drills.today")}>
      {plan.map((k, i) => (
        <li
          key={i}
          aria-current={i === results.length ? "step" : undefined}
          className={`rounded-base border px-3 py-1 text-supporting ${
            i === results.length ? "border-accent" : "border-line"
          }`}
        >
          {i < results.length ? "✓ " : ""}
          {t(`drills.kinds.${k}.name`)}
        </li>
      ))}
    </ol>
  );

  if (!kind) return null;
  return (
    <WritingWorkspace
      summary={`${t(`drills.kinds.${kind}.name`)} · ${t(`drills.kinds.${kind}.intro`)}`}
      label={t(`drills.kinds.${kind}.name`)}
      task={
        <div className="flex flex-col gap-4">
          <p className="text-ink-muted">
            {t("drills.intro", { count: plan.length })}{" "}
            {weak.length > 0 &&
              t("drills.because", {
                list: weak
                  .slice(0, 2)
                  .map((w) => t(`errors.${w}`))
                  .join("、"),
              })}
          </p>
          {steps}
          <p className="text-supporting text-ink-muted">
            {t(`drills.kinds.${kind}.intro`)}
          </p>
          <p className="text-supporting">
            <Link href="/writing/notebook" className="underline">
              {t("drills.toNotebook")}
            </Link>
          </p>
        </div>
      }
    >
      <h2 id="drill-title" className="shrink-0 font-display text-h3">
        {t(`drills.kinds.${kind}.name`)}
      </h2>
      <div key={`${kind}-${results.length}`}>{drill}</div>
    </WritingWorkspace>
  );
}

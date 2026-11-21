"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toLocalDate } from "@/lib/dates";
import { backTranslationItems } from "@/lib/writing/back-translation";
import {
  fixItems,
  rebuildParagraph,
  reorderParagraph,
  type DrillDayNumber,
} from "@/lib/writing/drills";
import {
  EXERCISE_KINDS,
  writingTimeId,
  type ExerciseKind,
} from "@/lib/writing/progress";
import type { WritingPrompt } from "@/lib/writing/types";
import { Button } from "../Button";
import { ButtonLink } from "../ButtonLink";
import { Card } from "../Card";
import { usePracticeTimer } from "../usePracticeTimer";
import { BackTranslation } from "./BackTranslation";
import {
  CombineDrill,
  FixDrill,
  ListenDrill,
  ParaphraseDrill,
  PatternDrill,
  RebuildDrill,
  ReorderDrill,
} from "./Drills";
import {
  useWritingData,
  useWritingProgress,
  useWritingSettings,
} from "./WritingProvider";
import { WritingWorkspace } from "./WritingWorkspace";

/** The listening video for the listen-then-write drill. */
const DEFAULT_LISTEN_VIDEO = "sintel";

/**
 * Days 2–6 (D195): the day's back-translation, 5–8 sentences from Day 1
 * (the learner's corrected sentences and the model's key sentences),
 * about 10 minutes, in the mode chosen in the writing settings. The
 * other seven drills are under "More practice", chosen by the learner;
 * they don't count toward the day.
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
  const settings = useWritingSettings();
  const { saveProgress } = useWritingData();
  const record = progress?.days[day];
  const [extra, setExtra] = useState<ExerciseKind | null>(null);
  usePracticeTimer(writingTimeId(prompt.id), false, {
    active: Boolean(progress) && !record?.done,
  });
  if (!progress || !settings) return null;
  const day1 = progress.days[1];
  const items = backTranslationItems({ prompt, day1, day });
  const reviewed = Boolean(day1?.feedback && !day1.feedback.declined);

  if (extra) {
    return (
      <ExtraDrill
        prompt={prompt}
        day={day}
        kind={extra}
        onBack={() => setExtra(null)}
      />
    );
  }

  const more = (
    <section aria-labelledby="more-practice" className="flex flex-col gap-3">
      <h2 id="more-practice" className="font-display text-h3">
        {t("drills.more")}
      </h2>
      <p className="text-supporting text-ink-muted">{t("drills.moreIntro")}</p>
      <ul className="flex flex-wrap gap-2">
        {EXERCISE_KINDS.filter(
          (kind) => kind !== "fix" || fixItems(day1?.feedback).length > 0,
        ).map((kind) => (
          <li key={kind}>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setExtra(kind)}
            >
              {t(`drills.kinds.${kind}.name`)}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );

  if (record?.done) {
    const back = record.drills.find((d) => d.kind === "back");
    return (
      <div className="flex flex-col gap-8">
        <Card role="status" className="flex flex-col gap-2">
          <p className="font-medium">{t("drills.dayDone")}</p>
          {back?.total ? (
            <p className="text-supporting tabular-nums">
              {t("back.dayResult", {
                right: back.right ?? 0,
                total: back.total,
              })}
            </p>
          ) : (
            <ul className="text-supporting">
              {record.drills.map((d, i) => (
                <li key={i}>
                  {d.correct ? "✓" : "…"} {t(`drills.kinds.${d.kind}.name`)}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/writing/notebook" variant="secondary" size="sm">
              {t("notebook.title")}
            </ButtonLink>
            <ButtonLink
              href={`/writing/${prompt.id}`}
              variant="ghost"
              size="sm"
            >
              {t("essay.toOverview")}
            </ButtonLink>
          </div>
        </Card>
        {more}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <BackTranslation
        key={day}
        promptId={prompt.id}
        items={items}
        mode={settings.dictation}
        intro={reviewed ? t("back.fromReview") : t("back.fromModel")}
        onDone={(results) =>
          saveProgress({
            ...progress,
            days: {
              ...progress.days,
              [day]: {
                done: true,
                date: toLocalDate(new Date()),
                drills: [
                  {
                    kind: "back",
                    done: true,
                    right: results.filter((r) => r.right).length,
                    total: results.length,
                    correct: results.every((r) => r.right),
                  },
                ],
              },
            },
            updatedAt: new Date().toISOString(),
          })
        }
      />
      {more}
    </div>
  );
}

/**
 * One of the seven drills, picked by the learner from "More practice"
 * (D195): practice only, not saved to the day.
 */
function ExtraDrill({
  prompt,
  day,
  kind,
  onBack,
}: {
  prompt: WritingPrompt;
  day: DrillDayNumber;
  kind: ExerciseKind;
  onBack: () => void;
}) {
  const t = useTranslations("writing");
  const progress = useWritingProgress(prompt.id);
  const [done, setDone] = useState<boolean | null>(null);
  const day1 = progress?.days[1];
  const fixes = fixItems(day1?.feedback);
  const offset = day - 2;
  const pick = <T,>(list: readonly T[]) =>
    list[offset % Math.max(1, list.length)];
  const finished = (correct: boolean) => setDone(correct);

  const drill = (() => {
    switch (kind) {
      case "fix":
        return (
          <FixDrill items={fixes} essay={day1?.essay ?? ""} onDone={finished} />
        );
      case "pattern":
        return (
          <PatternDrill pattern={pick(prompt.patterns)} onDone={finished} />
        );
      case "combine":
        return <CombineDrill item={pick(prompt.combine)} onDone={finished} />;
      case "paraphrase":
        return (
          <ParaphraseDrill item={pick(prompt.paraphrase)} onDone={finished} />
        );
      case "reorder":
        return (
          <ReorderDrill
            sentences={reorderParagraph(prompt)}
            seed={`${prompt.id}:${day}`}
            onDone={finished}
          />
        );
      case "rebuild":
        return (
          <RebuildDrill
            paragraph={rebuildParagraph(prompt)}
            onDone={finished}
          />
        );
      case "listen":
        return (
          <ListenDrill
            videoId={prompt.listenVideo ?? DEFAULT_LISTEN_VIDEO}
            onDone={finished}
          />
        );
    }
  })();

  return (
    <WritingWorkspace
      summary={`${t(`drills.kinds.${kind}.name`)} · ${t(`drills.kinds.${kind}.intro`)}`}
      label={t(`drills.kinds.${kind}.name`)}
      task={
        <div className="flex flex-col gap-4">
          <p className="text-supporting text-ink-muted">
            {t(`drills.kinds.${kind}.intro`)}
          </p>
          <p className="text-supporting text-ink-muted">
            {t("drills.extraNote")}
          </p>
          <div>
            <Button size="sm" variant="ghost" onClick={onBack}>
              {t("drills.backToDay")}
            </Button>
          </div>
        </div>
      }
    >
      <h2 id="drill-title" className="shrink-0 font-display text-h3">
        {t(`drills.kinds.${kind}.name`)}
      </h2>
      {done === null ? (
        drill
      ) : (
        <div role="status" className="flex flex-col gap-3">
          <p className={done ? "text-success" : ""}>
            {done ? t("drills.extraRight") : t("drills.extraDone")}
          </p>
          <div>
            <Button variant="primary" onClick={onBack}>
              {t("drills.backToDay")}
            </Button>
          </div>
        </div>
      )}
    </WritingWorkspace>
  );
}

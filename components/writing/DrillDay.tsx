"use client";

import { useTranslations } from "next-intl";
import { useLayoutEffect, useState } from "react";
import { toLocalDate } from "@/lib/dates";
import { wordDiff } from "@/lib/scoring/word-diff";
import {
  checkExtraAnswers,
  type BackCheckResult,
} from "@/app/writing/back-check-actions";
import {
  answerRun,
  applyChecks,
  explainRun,
  hintLevel,
  timesSeen,
  exactBack,
  pendingChecks,
  backNotebookItems,
  backTranslationItems,
  extraBackItems,
  newRun,
  nextIndex,
  runSummary,
  type BackAnswer,
  type BackRun,
} from "@/lib/writing/back-translation";
import { addToNotebook } from "@/lib/writing/notebook";
import {
  fixItems,
  rebuildParagraph,
  reorderParagraph,
  type DrillDayNumber,
} from "@/lib/writing/drills";
import {
  EXERCISE_KINDS,
  writingTimeId,
  type DrillDay as DrillDayRecord,
  type ExerciseKind,
} from "@/lib/writing/progress";
import type { WritingPrompt } from "@/lib/writing/types";
import { Button } from "../Button";
import { ButtonLink } from "../ButtonLink";
import { Card } from "../Card";
import { usePracticeTimer } from "../usePracticeTimer";
import { WordDiffView } from "../WordDiffView";
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
  useNotebook,
  useWritingData,
  useWritingProgress,
  useWritingSettings,
} from "./WritingProvider";
import { WritingWorkspace } from "./WritingWorkspace";

/** The listening video for the listen-then-write drill. */
const DEFAULT_LISTEN_VIDEO = "sintel";

type View = "day" | "summary" | "extra" | "extraDone" | ExerciseKind;

/**
 * Days 2–6 (D195, D199): the day's back-translation, 5–8 sentences from
 * Day 1 (the learner's corrected sentences and the model's key
 * sentences), about 10 minutes, in the mode chosen in the writing
 * settings. Each answer is saved at once (this browser, and the account
 * when signed in), so leaving, reloading, or trying another exercise
 * comes back to the sentence it was at. When the day is done: its
 * result, the mistakes, what went to the notebook, and extra practice
 * (another set, its own progress, never changing the day's result). The
 * other seven drills are under "More practice".
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
  const notebook = useNotebook();
  const { cloud, saveProgress, saveNotebook } = useWritingData();
  const record = progress?.days[day];
  const [view, setView] = useState<View>("day");
  // Answering here now: the last sentence's result shows before the
  // set's result, though the set is saved as done already.
  const [live, setLive] = useState(false);
  const [check, setCheck] = useState<CheckState | null>(null);
  // Another view (extra practice, a drill, the result) starts at the top,
  // not where the last one was scrolled to; before the workspace fits
  // itself to the screen (its effect runs after this layout effect).
  useLayoutEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);
  usePracticeTimer(writingTimeId(prompt.id), false, {
    active: Boolean(progress) && (!record?.done || view === "extra"),
  });
  if (!progress || !settings || !notebook) return null;
  const day1 = progress.days[1];
  const reviewed = Boolean(day1?.feedback && !day1.feedback.declined);
  const run =
    record?.back ?? newRun(backTranslationItems({ prompt, day1, day }));
  const today = () => toLocalDate(new Date());

  const saveDay = (next: DrillDayRecord) =>
    saveProgress({
      ...progress,
      days: { ...progress.days, [day]: next },
      updatedAt: new Date().toISOString(),
    });
  // The last earlier day with a result, to compare with (round 1, F3).
  const previousResult = (() => {
    for (let d = day - 1; d >= 2; d--) {
      const back = progress.days[d as DrillDayNumber]?.back;
      if (back?.done) return { day: d, percent: runSummary(back).percent };
    }
    return undefined;
  })();

  const toNotebook = (from: BackRun) => {
    const items = backNotebookItems(prompt.id, from);
    if (items.length) saveNotebook(addToNotebook(notebook, items, today()));
  };

  // The learning-science helps, each switchable in the settings (D202).
  const coachFor = (current: BackRun) => ({
    confidence: settings.confidence,
    selfExplain: settings.selfExplain,
    hint: settings.scaffold
      ? (index: number) =>
          hintLevel(
            timesSeen(progress.days, current.items[index]?.en ?? "", current),
          )
      : undefined,
  });

  const answerDay = (index: number, answer: BackAnswer) => {
    const back = answerRun(run, index, answer);
    if (back === run) return;
    setLive(true);
    if (!back.done) {
      saveDay({ done: false, drills: [], ...record, back });
      return;
    }
    // The last sentence: the day is done now, whether or not "Finish" is
    // pressed (leaving here still counts the day).
    const summary = runSummary(back);
    saveDay({
      ...record,
      back,
      done: true,
      date: today(),
      drills: [
        {
          kind: "back",
          done: true,
          right: summary.right,
          total: summary.total,
          correct: summary.right === summary.total,
        },
      ],
    });
    toNotebook(back);
  };

  const explainDay = (index: number, text: string) => {
    const latest = record?.back;
    if (!record || !latest) return;
    const back = explainRun(latest, index, text);
    if (back !== latest) saveDay({ ...record, back });
  };
  const explainExtra = (index: number, text: string) => {
    const extra = record?.extra;
    if (!record || !extra) return;
    const next = explainRun(extra, index, text);
    if (next !== extra)
      saveDay({ ...record, extra: { ...next, round: extra.round } });
  };

  const startExtra = () => {
    setCheck(null);
    const current = record?.extra;
    if (current && !current.done) {
      setView("extra");
      return;
    }
    const round = (current?.round ?? 0) + 1;
    const items = extraBackItems({
      prompt,
      day1,
      day,
      round,
      exclude: run.items,
      seen: current?.items,
    });
    if (record && items.length) {
      saveDay({ ...record, extra: { ...newRun(items), round } });
    }
    setView("extra");
  };
  // The AI checks extra practice when signed in and not turned off (D200).
  const aiOn = Boolean(cloud) && settings.extraAi;
  const answerExtra = (index: number, answer: BackAnswer) => {
    const extra = record?.extra;
    const item = extra?.items[index];
    if (!record || !extra || !item) return;
    const pending = aiOn && !exactBack(item, answer, answer.answer);
    const next = answerRun(
      extra,
      index,
      pending ? { ...answer, pending: true } : answer,
    );
    setLive(true);
    if (next !== extra)
      saveDay({ ...record, extra: { ...next, round: extra.round } });
  };
  const endExtra = async () => {
    const extra = record?.extra;
    setLive(false);
    setView("extraDone");
    if (!record || !extra) return;
    let ended: BackRun & { round: number } = { ...extra, done: true };
    if (!extra.done) saveDay({ ...record, extra: ended });
    const pending = pendingChecks(ended);
    if (pending.length > 0) {
      // All of the set's answers that need it, in one call; whatever
      // stops it, the rules' results stand and the practice goes on.
      setCheck({ state: "checking" });
      const result: BackCheckResult = await checkExtraAnswers({
        items: pending,
      }).catch(() => ({ ok: false, reason: "failed" }) as const);
      ended = {
        ...applyChecks(ended, result.ok ? result.judgements : []),
        round: ended.round,
      };
      saveDay({ ...record, extra: ended });
      setCheck(
        result.ok
          ? {
              state: "done",
              count: result.judgements.length,
              left: result.left,
            }
          : { state: "off", reason: result.reason, max: result.max },
      );
    }
    toNotebook(ended);
  };

  if (
    view === "fix" ||
    view === "pattern" ||
    view === "combine" ||
    view === "paraphrase" ||
    view === "reorder" ||
    view === "rebuild" ||
    view === "listen"
  ) {
    return (
      <ExtraDrill
        prompt={prompt}
        day={day}
        kind={view}
        onBack={() => setView("day")}
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
        {EXERCISE_KINDS.filter((kind) =>
          kind === "fix"
            ? fixItems(day1?.feedback).length > 0
            : // Without a model essay (a custom prompt, D196), only the
              // listening drill has something to practise.
              kind === "listen" || prompt.model.en.length > 0,
        ).map((kind) => (
          <li key={kind}>
            <Button size="sm" variant="secondary" onClick={() => setView(kind)}>
              {t(`drills.kinds.${kind}.name`)}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );

  if (view === "extra" && record?.done) {
    const extra = record.extra;
    if (!extra || extra.items.length === 0) {
      return (
        <Card role="status" className="flex flex-col gap-3">
          <p>{t("back.noExtra")}</p>
          <div>
            <Button variant="primary" onClick={() => setView("summary")}>
              {t("back.toResult")}
            </Button>
          </div>
        </Card>
      );
    }
    if (extra.done && !live) {
      return (
        <RunResult
          run={extra}
          extra
          check={check}
          onExtra={startExtra}
          onBack={() => setView("summary")}
        />
      );
    }
    return (
      <BackTranslation
        key={`extra-${extra.round}`}
        promptId={prompt.id}
        run={extra}
        mode={settings.dictation}
        extra={{ onEnd: endExtra }}
        coach={coachFor(extra)}
        onExplain={explainExtra}
        onAnswer={answerExtra}
        onFinish={endExtra}
        aside={
          <>
            <p className="text-supporting text-ink-muted">
              {t("back.extraNote")}
            </p>
            <p className="text-supporting text-ink-muted">
              {!cloud
                ? t("back.aiSignIn")
                : settings.extraAi
                  ? t("back.aiOn")
                  : t("back.aiOff")}
            </p>
          </>
        }
      />
    );
  }

  if (view === "extraDone" && record?.extra) {
    return (
      <RunResult
        run={record.extra}
        extra
        check={check}
        onExtra={startExtra}
        onBack={() => setView("summary")}
      />
    );
  }

  if (record?.done && !(view === "day" && live)) {
    const back = record.drills.find((d) => d.kind === "back");
    const extra = record.extra;
    return (
      <div className="flex flex-col gap-8">
        {record.back ? (
          <RunResult
            run={record.back}
            previous={previousResult}
            onExtra={startExtra}
            continueExtra={
              extra && !extra.done
                ? { n: nextIndex(extra) + 1, total: extra.items.length }
                : undefined
            }
          />
        ) : (
          // Done before D199: only the count was kept.
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
              <ButtonLink
                href="/writing/notebook"
                variant="secondary"
                size="sm"
              >
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
        )}
        {more}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <BackTranslation
        key={day}
        promptId={prompt.id}
        run={run}
        mode={settings.dictation}
        intro={reviewed ? t("back.fromReview") : t("back.fromModel")}
        coach={coachFor(run)}
        onExplain={explainDay}
        onAnswer={answerDay}
        onFinish={() => {
          setLive(false);
          setView("summary");
        }}
      />
      {more}
    </div>
  );
}

/**
 * A set's result (D199): how many were right and the mean accuracy, each
 * sentence written wrong with its differences, what went to the
 * notebook; then on to extra practice, the notebook, or home.
 */
function RunResult({
  run,
  extra = false,
  check = null,
  previous,
  continueExtra,
  onExtra,
  onBack,
}: {
  run: BackRun;
  extra?: boolean;
  /** Extra practice: the AI check of its answers (D200). */
  check?: CheckState | null;
  /** The day before's result, to see the change (round 1, F3). */
  previous?: { day: number; percent: number };
  /** Extra practice left half done: where it is. */
  continueExtra?: { n: number; total: number };
  onExtra: () => void;
  /** Extra practice: back to the day's result. */
  onBack?: () => void;
}) {
  const t = useTranslations("writing");
  const summary = runSummary(run);
  const wrong = run.items.flatMap((item, i) => {
    const answer = run.answers[i];
    return answer && !answer.right ? [{ item, answer }] : [];
  });
  // Written another way, and right by the AI: worth seeing too.
  const accepted = run.items.flatMap((item, i) => {
    const answer = run.answers[i];
    return answer?.ai && answer.right ? [{ item, answer }] : [];
  });
  return (
    <div className="flex flex-col gap-6">
      <Card role="status" className="flex flex-col gap-2">
        <h2 className="font-display text-h3">
          {extra ? t("back.extraDoneTitle") : t("drills.dayDone")}
        </h2>
        <p className="tabular-nums">
          {t("back.runResult", {
            right: summary.right,
            answered: summary.answered,
            percent: summary.percent,
          })}
        </p>
        {check && (
          <p className="text-supporting" aria-live="polite">
            {check.state === "checking"
              ? t("back.aiChecking")
              : check.state === "done"
                ? `${t("back.aiDone", { count: check.count })}${
                    check.left === null
                      ? ""
                      : t("back.aiLeft", { left: check.left })
                  }`
                : t(`back.aiStopped.${check.reason}`, { max: check.max ?? 0 })}
          </p>
        )}
        {previous && (
          <p className="text-supporting tabular-nums">
            {t("back.compare", {
              day: previous.day,
              percent: previous.percent,
              change:
                summary.percent - previous.percent > 0
                  ? `+${summary.percent - previous.percent}`
                  : `${summary.percent - previous.percent}`,
            })}
          </p>
        )}
      </Card>
      {/* What's next before the details, so it's in reach on a phone. */}
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" onClick={onExtra}>
          {continueExtra
            ? t("back.continueExtra", continueExtra)
            : extra
              ? t("back.extraAgain")
              : t("back.extra")}
        </Button>
        <ButtonLink href="/writing/notebook" variant="secondary">
          {t("notebook.title")}
        </ButtonLink>
        {onBack ? (
          <Button variant="ghost" onClick={onBack}>
            {t("back.toResult")}
          </Button>
        ) : (
          <ButtonLink href="/" variant="ghost">
            {t("back.home")}
          </ButtonLink>
        )}
      </div>
      {wrong.length > 0 && (
        <section aria-labelledby="back-wrong" className="flex flex-col gap-3">
          <h3 id="back-wrong" className="font-medium">
            {t("back.wrongTitle", { count: wrong.length })}
          </h3>
          <ul className="flex flex-col gap-4">
            {wrong.map(({ item, answer }, i) => (
              <li
                key={i}
                className="flex flex-col gap-1 border-b border-line pb-3"
              >
                {answer.mode === "listen-zh" ? (
                  <dl className="grid gap-1 text-supporting">
                    <dt className="text-ink-muted">{t("back.youWrote")}</dt>
                    <dd lang="zh-Hant">{answer.answer}</dd>
                    <dt className="text-ink-muted">{t("back.meaning")}</dt>
                    <dd lang="zh-Hant">{item.zh}</dd>
                    <dt className="text-ink-muted">{t("back.english")}</dt>
                    <dd lang="en">{item.en}</dd>
                  </dl>
                ) : (
                  <WordDiffView diff={wordDiff(item.en, answer.answer)} />
                )}
                <AiNote answer={answer} />
              </li>
            ))}
          </ul>
          <p className="text-supporting text-ink-muted">
            {t("back.toNotebook", { count: wrong.length })}
          </p>
        </section>
      )}
      {accepted.length > 0 && (
        <section aria-labelledby="back-ok" className="flex flex-col gap-3">
          <h3 id="back-ok" className="font-medium">
            {t("back.acceptedTitle", { count: accepted.length })}
          </h3>
          <ul className="flex flex-col gap-4">
            {accepted.map(({ item, answer }, i) => (
              <li
                key={i}
                className="flex flex-col gap-1 border-b border-line pb-3 text-supporting"
              >
                <p>
                  <span className="text-ink-muted">{t("back.youWrote")}：</span>
                  <span lang={answer.mode === "listen-zh" ? "zh-Hant" : "en"}>
                    {answer.answer}
                  </span>
                </p>
                <p>
                  <span className="text-ink-muted">{t("back.english")}：</span>
                  <span lang="en">{item.en}</span>
                </p>
                <AiNote answer={answer} />
              </li>
            ))}
          </ul>
        </section>
      )}
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
        </div>
      }
      actions={
        // Always in view (on a phone the task column is folded away).
        done === null && (
          <Button size="sm" variant="ghost" onClick={onBack}>
            {t("drills.backToDay")}
          </Button>
        )
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

/** Where extra practice's AI check is (D200). */
type CheckState =
  | { state: "checking" }
  | { state: "done"; count: number; left: number | null }
  | {
      state: "off";
      reason: Exclude<BackCheckResult, { ok: true }>["reason"];
      max?: number;
    };

/** The AI's reason and a better way, under an answer it checked (D200). */
function AiNote({ answer }: { answer: BackAnswer }) {
  const t = useTranslations("writing.back");
  if (!answer.ai) return null;
  return (
    <div className="flex flex-col gap-1 text-supporting">
      <p>
        <span className="text-ink-muted">{t("aiWhy")}</span>{" "}
        <span lang="zh-Hant">{answer.ai.why}</span>
      </p>
      {answer.ai.better && (
        <p>
          <span className="text-ink-muted">{t("aiBetter")}</span>{" "}
          <span lang="en">{answer.ai.better}</span>
        </p>
      )}
    </div>
  );
}

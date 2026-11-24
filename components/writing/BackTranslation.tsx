"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { writingSentenceAudioUrl } from "@/app/writing/audio-actions";
import { wordDiff } from "@/lib/scoring/word-diff";
import {
  checkBack,
  itemMode,
  nextIndex,
  type BackAnswer,
  type BackRun,
} from "@/lib/writing/back-translation";
import type { DictationMode } from "@/lib/writing/settings";
import { Button } from "../Button";
import { ProgressBar } from "../ProgressBar";
import { useWordSound } from "../useWordSound";
import { WordDiffView } from "../WordDiffView";
import { WritingWorkspace } from "./WritingWorkspace";

/** The pause between plays when looping a sentence. */
const LOOP_GAP_MS = 1_500;

/**
 * A set of back-translation sentences (聽寫回譯, D195, D199): each
 * sentence heard (or read in Chinese), written back, and checked at once
 * by ListenLoop's dictation rules. The set is saved answer by answer by
 * the caller (`onAnswer`), so leaving and coming back carries on at the
 * first sentence still to answer.
 *
 * Every sentence goes the same way: it plays on arrival (listening
 * modes), the learner writes and checks, the result and the explanation
 * show, and the same button (beside the box, so a phone's keyboard never
 * hides it) goes on to the next sentence, which plays. Answered sentences
 * can be opened again from the progress bar; they don't reset.
 */
export function BackTranslation({
  promptId,
  run,
  mode,
  intro,
  extra,
  onAnswer,
  onFinish,
  aside,
}: {
  promptId: string;
  run: BackRun;
  mode: DictationMode;
  /** Why these sentences, shown with the instructions. */
  intro?: string;
  /** Extra practice: its own words, and it can be ended at any time. */
  extra?: { onEnd: () => void };
  onAnswer: (index: number, answer: BackAnswer) => void;
  /** After the last sentence's result: the set is over. */
  onFinish: () => void;
  /** More for the task column (extra practice's notes). */
  aside?: ReactNode;
}) {
  const t = useTranslations("writing.back");
  const total = run.items.length;
  const current = nextIndex(run);
  // A sentence opened again from the list, and the one just checked
  // (its result stays until "Next").
  const [opened, setOpened] = useState<number | null>(null);
  const [checked, setChecked] = useState<number | null>(null);
  const [answer, setAnswer] = useState("");
  const [loop, setLoop] = useState(false);
  const index = Math.min(opened ?? checked ?? current, total - 1);
  const item = run.items[index];
  const result = run.answers[index] ?? null;
  const asked = item ? itemMode(item, mode) : mode;
  const listening = asked !== "read-zh";
  const sound = useWordSound(promptId, item?.en ?? null, {
    loop,
    gapMs: LOOP_GAP_MS,
    audioUrl: writingSentenceAudioUrl,
    // Reading the Chinese: the English is a hint, played only on request.
    // An answered sentence opened again doesn't play by itself.
    autoplay: listening && !result,
  });

  if (!item) return null;
  const allDone = current >= total;

  const check = () => {
    if (result || !answer.trim()) return;
    setLoop(false);
    onAnswer(index, { ...checkBack(item, mode, answer), answer });
    setChecked(index);
    setOpened(null);
    setAnswer("");
  };
  const next = () => {
    setLoop(false);
    setOpened(null);
    setChecked(null);
    if (allDone) onFinish();
  };
  const keys = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter checks (or goes on); Shift+Enter is a new line.
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (result) next();
    else check();
  };
  const open = (n: number) => {
    setLoop(false);
    setChecked(null);
    setOpened(n === current ? null : n);
  };

  const position = t("count", { n: index + 1, total });
  const done = run.answers.filter(Boolean).length;
  // Answered sentences open again from here (in the task column: on a
  // phone, under "show the task", so the bar above the box stays short).
  const list = (
    <nav aria-label={t("sentences")}>
      <ol className="flex flex-wrap gap-2">
        {run.items.map((_, n) => {
          const a = run.answers[n];
          const reachable = Boolean(a) || n === current;
          return (
            <li key={n}>
              <button
                type="button"
                onClick={() => open(n)}
                disabled={!reachable}
                aria-current={n === index ? "step" : undefined}
                aria-label={t("go", {
                  n: n + 1,
                  state: a ? (a.right ? "right" : "wrong") : "todo",
                })}
                className={`tap flex min-h-11 min-w-11 items-center justify-center gap-0.5 rounded-base border px-2 text-supporting tabular-nums disabled:opacity-50 ${
                  n === index ? "border-ink font-medium" : "border-line"
                } ${a ? (a.right ? "text-success" : "text-error") : ""}`}
              >
                {n + 1}
                {a && <span aria-hidden="true">{a.right ? "✓" : "✗"}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );

  const controls = (
    <div className="flex flex-col gap-2 rounded-base border border-line bg-surface p-2 wide:gap-3 wide:p-3">
      {/* Wide: the labelled bar. Phones: a thin line (the summary line
          above already says which sentence), to leave room for the box. */}
      <ProgressBar
        className="hidden wide:block"
        value={done}
        max={total}
        label={position}
        showCount={false}
        valueText={t("progressText", { done, total })}
      />
      <div
        role="progressbar"
        aria-label={position}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={t("progressText", { done, total })}
        className="h-1 bg-line wide:hidden"
      >
        <div
          className="h-full bg-accent transition-[width] duration-(--ll-duration-progress) motion-reduce:transition-none"
          style={{ width: `${(done / total) * 100}%` }}
        />
      </div>
      {asked === "read-zh" && (
        <p className="text-sentence" lang="zh-Hant">
          {item.zh}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={listening ? "primary" : "secondary"}
          onClick={sound.play}
          disabled={!sound.ready}
        >
          {listening ? t("replay") : t("hint")}
        </Button>
        {listening && (
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={loop}
            onClick={() => setLoop(!loop)}
          >
            {loop ? t("loopOn") : t("loopOff")}
          </Button>
        )}
        {extra && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={extra.onEnd}
          >
            {t("endExtra")}
          </Button>
        )}
      </div>
    </div>
  );

  // One button, always in the same place beside the box: Check, then
  // Next (or Finish), then back to the sentence to do.
  const action = !result ? (
    <Button variant="primary" onClick={check} disabled={!answer.trim()}>
      {t("check")}
    </Button>
  ) : (
    <Button variant="primary" onClick={next}>
      {!allDone && opened !== null
        ? t("backTo", { n: current + 1 })
        : allDone
          ? extra
            ? t("finishExtra")
            : t("finish")
          : t("next")}
    </Button>
  );

  return (
    <WritingWorkspace
      summary={`${position} · ${t(`modes.${asked}.name`)}`}
      label={t(`modes.${asked}.label`)}
      audio={controls}
      actions={action}
      task={
        <div className="flex flex-col gap-3">
          {extra && <p className="font-medium">{t("extraTitle")}</p>}
          {list}
          <p>{t(`modes.${asked}.intro`)}</p>
          {asked !== mode && (
            <p className="text-supporting text-ink-muted">{t("noMeaning")}</p>
          )}
          {intro && <p className="text-supporting text-ink-muted">{intro}</p>}
          <p className="text-supporting text-ink-muted">{t("rules")}</p>
          {aside}
          <p className="text-supporting">
            <Link href="/account#writing-settings" className="underline">
              {t("changeMode")}
            </Link>
          </p>
        </div>
      }
    >
      <label
        htmlFor="back-answer"
        className="sr-only shrink-0 font-medium wide:not-sr-only"
      >
        {t(`modes.${asked}.label`)}
      </label>
      <div className="flex min-h-14 flex-1 wide:flex-none">
        <textarea
          id="back-answer"
          key={index}
          lang={asked === "listen-zh" ? "zh-Hant" : "en"}
          rows={3}
          value={result ? result.answer : answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={keys}
          readOnly={Boolean(result)}
          spellCheck={false}
          autoCapitalize={asked === "listen-zh" ? "off" : "sentences"}
          autoComplete="off"
          placeholder={t(`modes.${asked}.label`)}
          className="min-h-14 w-full min-w-0 flex-1 resize-none rounded-base border border-line bg-surface p-3 text-sentence focus:border-ink"
        />
      </div>
      {result && (
        <div
          role="status"
          ref={(element) =>
            // The result in view inside the answer column.
            element?.scrollIntoView({ block: "nearest" })
          }
          className="flex shrink-0 flex-col gap-3"
        >
          <p className={result.right ? "text-success" : ""}>
            {result.right ? t("right") : t("close")}{" "}
            <span className="tabular-nums">
              {t("score", { percent: Math.round(result.score * 100) })}
            </span>
          </p>
          {result.mode === "listen-zh" ? (
            <dl className="grid gap-1 text-supporting">
              <dt className="text-ink-muted">{t("meaning")}</dt>
              <dd lang="zh-Hant">{item.zh}</dd>
              <dt className="text-ink-muted">{t("english")}</dt>
              <dd lang="en">{item.en}</dd>
            </dl>
          ) : (
            <>
              <WordDiffView diff={wordDiff(item.en, result.answer)} />
              {item.zh && (
                <p className="text-supporting text-ink-muted" lang="zh-Hant">
                  {item.zh}
                </p>
              )}
            </>
          )}
          {result.pending && (
            <p className="text-supporting text-ink-muted">{t("aiLater")}</p>
          )}
          {item.source === "fix" && (
            <p className="text-supporting text-ink-muted">{t("fromFix")}</p>
          )}
        </div>
      )}
    </WritingWorkspace>
  );
}

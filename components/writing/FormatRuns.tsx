"use client";

import { useTranslations } from "next-intl";
import { Fragment, useState, type KeyboardEvent } from "react";
import { writingSentenceAudioUrl } from "@/app/writing/audio-actions";
import { toLocalDate } from "@/lib/dates";
import { wordDiff, type DisplayWord } from "@/lib/scoring/word-diff";
import {
  nextIndex,
  type BackAnswer,
  type BackRun,
} from "@/lib/writing/back-translation";
import { checkCloze, clozeBlanks } from "@/lib/writing/day-formats";
import { Button } from "../Button";
import { PlaybackControls } from "../PlaybackControls";
import { ProgressBar } from "../ProgressBar";
import { usePlayback } from "../usePlayback";
import { useWordSound } from "../useWordSound";
import { WritingWorkspace } from "./WritingWorkspace";

type RunProps = {
  promptId: string;
  run: BackRun;
  onAnswer: (index: number, answer: BackAnswer) => void;
  onFinish: () => void;
};

/** One sentence's sound with the kept playback settings (D220). */
function useSentenceSound(promptId: string, en: string | null, auto: boolean) {
  const [playback, change] = usePlayback();
  const sound = useWordSound(promptId, en, {
    loop: playback.loop,
    gapMs: playback.gap * 1000,
    audioUrl: writingSentenceAudioUrl,
    autoplay: auto && playback.autoplay,
    repeats: playback.repeats,
    rate: playback.speed,
    voice: playback.voice,
  });
  return {
    sound,
    loop: playback.loop,
    setLoop: (on: boolean) => change({ loop: on }),
  };
}

function Controls({
  done,
  total,
  label,
  sound,
  loop,
  setLoop,
}: {
  done: number;
  total: number;
  label: string;
  sound: { play: () => void; ready: boolean };
  loop: boolean;
  setLoop: (on: boolean) => void;
}) {
  const t = useTranslations("writing.back");
  return (
    <div className="flex flex-col gap-2 rounded-base border border-line bg-surface p-2 wide:gap-3 wide:p-3">
      <ProgressBar
        value={done}
        max={total}
        label={label}
        showCount={false}
        valueText={t("progressText", { done, total })}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="primary"
          onClick={sound.play}
          disabled={!sound.ready}
        >
          {t("replay")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-pressed={loop}
          onClick={() => setLoop(!loop)}
        >
          {loop ? t("loopOn") : t("loopOff")}
        </Button>
        <PlaybackControls compact />
      </div>
    </div>
  );
}

function Words({
  words,
  render,
}: {
  words: DisplayWord[];
  render: (word: DisplayWord) => React.ReactNode;
}) {
  return words.map((word, index) => (
    <Fragment key={index}>
      {index > 0 && " "}
      {word.ok ? word.text : render(word)}
    </Fragment>
  ));
}

/**
 * Day 2's "listen and read" (D219): each sentence of the chosen version
 * plays, next to what the learner first wrote, the changes marked (the
 * noticing step, learning-science.md §17). Nothing to type: "Next" marks
 * it seen.
 */
export function ListenReadRun({ promptId, run, onAnswer, onFinish }: RunProps) {
  const t = useTranslations("writing.formats");
  const tBack = useTranslations("writing.back");
  const total = run.items.length;
  const index = Math.min(nextIndex(run), total - 1);
  const item = run.items[index];
  const { sound, loop, setLoop } = useSentenceSound(
    promptId,
    item?.en ?? null,
    true,
  );
  if (!item) return null;
  const done = run.answers.filter(Boolean).length;
  const last = done >= total - 1;
  const next = () => {
    setLoop(false);
    if (!run.answers[index]) {
      onAnswer(index, {
        mode: "listen-write",
        score: 1,
        right: true,
        answer: "",
        viewed: true,
        date: toLocalDate(new Date()),
      });
    }
    if (last) onFinish();
  };
  const diff = item.original ? wordDiff(item.en, item.original) : null;
  const position = tBack("count", { n: index + 1, total });
  return (
    <WritingWorkspace
      summary={`${position} · ${t("listen-read.name")}`}
      label={t("listen-read.label")}
      audio={
        <Controls
          done={done}
          total={total}
          label={position}
          sound={sound}
          loop={loop}
          setLoop={setLoop}
        />
      }
      actions={
        <Button variant="primary" onClick={next}>
          {last ? t("finish") : t("next")}
        </Button>
      }
      task={<p>{t("listen-read.intro")}</p>}
    >
      <dl
        data-testid="listen-read"
        className="flex flex-col gap-3 overflow-y-auto text-sentence"
      >
        <dt className="text-metadata text-ink-muted">{t("yours")}</dt>
        <dd lang="en" className="text-ink-muted">
          {diff ? (
            <Words
              words={diff.answer}
              render={(w) => <del className="decoration-1">{w.text}</del>}
            />
          ) : (
            item.en
          )}
        </dd>
        <dt className="text-metadata text-ink-muted">{t("correct")}</dt>
        <dd lang="en">
          {diff ? (
            <Words
              words={diff.reference}
              render={(w) => (
                <ins className="bg-accent/14 font-medium text-accent-ink underline decoration-accent decoration-2 underline-offset-4">
                  {w.text}
                </ins>
              )}
            />
          ) : (
            item.en
          )}
        </dd>
        {!diff && item.source === "own" && (
          <dd className="text-supporting text-success">{t("noChange")}</dd>
        )}
        {item.zh && (
          <dd lang="zh-Hant" className="text-supporting text-ink-muted">
            {item.zh}
          </dd>
        )}
      </dl>
    </WritingWorkspace>
  );
}

/**
 * Day 3's cloze (D219): 1–3 words of each sentence hidden (the changed
 * ones first), heard and filled in, checked word by word.
 */
export function ClozeRun({ promptId, run, onAnswer, onFinish }: RunProps) {
  const t = useTranslations("writing.formats");
  const tBack = useTranslations("writing.back");
  const total = run.items.length;
  const current = nextIndex(run);
  const [checked, setChecked] = useState<number | null>(null);
  const index = Math.min(checked ?? current, total - 1);
  const item = run.items[index];
  const result = run.answers[index] ?? null;
  const [answers, setAnswers] = useState<string[]>([]);
  const { sound, loop, setLoop } = useSentenceSound(
    promptId,
    item?.en ?? null,
    !result,
  );
  if (!item) return null;
  const blanks = clozeBlanks(item);
  const words = item.en.split(/\s+/).filter(Boolean);
  const given = result ? result.answer.split(" / ") : answers;
  const marks = result ? checkCloze(item.en, blanks, given).right : null;
  const done = run.answers.filter(Boolean).length;
  const allDone = current >= total;

  const check = () => {
    if (result) return;
    const { right, score } = checkCloze(item.en, blanks, answers);
    setLoop(false);
    onAnswer(index, {
      mode: "listen-write",
      score,
      right: right.every(Boolean),
      answer: blanks.map((_, k) => answers[k] ?? "").join(" / "),
      date: toLocalDate(new Date()),
    });
    setChecked(index);
    setAnswers([]);
  };
  const next = () => {
    setChecked(null);
    setLoop(false);
    if (allDone) onFinish();
  };
  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (result) next();
    else check();
  };
  const position = tBack("count", { n: index + 1, total });
  return (
    <WritingWorkspace
      summary={`${position} · ${t("cloze.name")}`}
      label={t("cloze.label")}
      audio={
        <Controls
          done={done}
          total={total}
          label={position}
          sound={sound}
          loop={loop}
          setLoop={setLoop}
        />
      }
      actions={
        result ? (
          <Button variant="primary" onClick={next}>
            {allDone ? tBack("finish") : tBack("next")}
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={check}
            disabled={blanks.some((_, k) => !answers[k]?.trim())}
          >
            {t("check")}
          </Button>
        )
      }
      task={<p>{t("cloze.intro")}</p>}
    >
      <p lang="en" data-testid="cloze" className="text-sentence leading-loose">
        {words.map((word, w) => {
          const k = blanks.indexOf(w);
          if (k === -1) {
            return (
              <Fragment key={w}>
                {w > 0 && " "}
                {word}
              </Fragment>
            );
          }
          const bare = word.replace(/[^A-Za-z0-9'-]/g, "");
          return (
            <Fragment key={w}>
              {w > 0 && " "}
              <input
                key={`${index}:${w}`}
                aria-label={t("blank", { n: k + 1 })}
                value={given[k] ?? ""}
                readOnly={Boolean(result)}
                onChange={(e) =>
                  setAnswers((a) => {
                    const copy = [...a];
                    copy[k] = e.target.value;
                    return copy;
                  })
                }
                onKeyDown={keys}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                size={Math.max(4, bare.length + 1)}
                className={`mx-0.5 min-h-8 rounded-base border bg-surface px-1 text-center pointer-coarse:min-h-11 ${
                  marks
                    ? marks[k]
                      ? "border-success"
                      : "border-error"
                    : "border-line focus:border-ink"
                }`}
              />
              {word.slice(word.lastIndexOf(bare) + bare.length)}
            </Fragment>
          );
        })}
      </p>
      {result && marks && (
        <div role="status" className="flex flex-col gap-2 text-supporting">
          <ul className="flex flex-col gap-1">
            {blanks.map((b, k) => {
              const word = words[b].replace(/[^A-Za-z0-9'-]/g, "");
              return (
                <li
                  key={b}
                  lang="en"
                  className={marks[k] ? "text-success" : "text-error"}
                >
                  {marks[k]
                    ? t("blankRight", { word })
                    : t("blankWrong", { word, answer: given[k] ?? "" })}
                </li>
              );
            })}
          </ul>
          <p lang="en">{item.en}</p>
          {item.zh && (
            <p lang="zh-Hant" className="text-ink-muted">
              {item.zh}
            </p>
          )}
        </div>
      )}
    </WritingWorkspace>
  );
}

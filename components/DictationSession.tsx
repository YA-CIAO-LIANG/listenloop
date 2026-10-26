"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toLocalDate } from "@/lib/dates";
import {
  nextUnanswered,
  startDictation,
  submitAnswer,
  type DictationDay,
} from "@/lib/dictation";
import { paddedSegment } from "@/lib/player/padding";
import type { Progress } from "@/lib/progress";
import { scoreDictation } from "@/lib/scoring/dictation";
import { wordDiff } from "@/lib/scoring/word-diff";
import { createLocalProgressStore } from "@/lib/storage/local-progress-store";
import type { ProgressStore } from "@/lib/storage/progress-store";
import type { Video } from "@/lib/videos";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";
import { CaptionHint } from "./CaptionHint";
import { ProgressBar } from "./ProgressBar";
import { ScoreBadge } from "./ScoreBadge";
import { SentencePlayer } from "./SentencePlayer";
import { SentenceRow } from "./SentenceRow";
import { WordDiffView } from "./WordDiffView";
import { YouTubeFrame } from "./youtube/YouTubeFrame";
import { useYouTubePlayer } from "./youtube/useYouTubePlayer";

type DictationSessionProps = {
  video: Video;
  day: DictationDay;
  /** Injected in tests; defaults to localStorage. */
  store?: ProgressStore;
};

/**
 * One-sentence-at-a-time dictation: play → type → Enter → see the diff →
 * Enter for the next sentence (which plays automatically). Every submission
 * is saved, so leaving and coming back resumes at the next sentence.
 */
export function DictationSession({ video, day, store }: DictationSessionProps) {
  const t = useTranslations("dictation");
  const tProgress = useTranslations("practice.progress");
  const format = useFormatter();
  const player = useYouTubePlayer(video.youtubeId);
  const [progressStore] = useState(() => store ?? createLocalProgressStore());
  const [progress, setProgress] = useState<Progress | null>(null);
  const [current, setCurrent] = useState(0);
  // Index whose feedback is showing (after submit, before "next").
  const [feedbackIndex, setFeedbackIndex] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const { sentences } = video;
  const answers = progress?.days[day]?.answers ?? [];
  const answeredCount = answers.filter((a) => a !== null).length;
  const done = progress?.days[day]?.done ?? false;

  async function save(next: Progress) {
    try {
      await progressStore.save(next);
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  }

  // Load saved progress (or start fresh) once, in the browser.
  useEffect(() => {
    let cancelled = false;
    progressStore.get(video.id).then((saved) => {
      if (cancelled) return;
      const started = startDictation(
        saved,
        video.id,
        day,
        sentences.length,
        toLocalDate(new Date()),
      );
      setProgress(started);
      setCurrent(Math.max(0, nextUnanswered(started.days[day]?.answers ?? [])));
      if (started !== saved) void save(started);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per video/day
  }, [progressStore, video.id, day, sentences.length]);

  // Keyboard flow: focus "next" after submitting, the input otherwise.
  // `loaded` matters: the input only appears once progress has loaded.
  const loaded = progress !== null;
  useEffect(() => {
    if (feedbackIndex !== null) nextRef.current?.focus();
    else inputRef.current?.focus();
  }, [loaded, feedbackIndex, current]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!progress || input.trim() === "") return;
    const next = submitAnswer(
      progress,
      day,
      current,
      input.trim(),
      sentences,
      toLocalDate(new Date()),
    );
    setProgress(next);
    setFeedbackIndex(current);
    setInput("");
    void save(next);
  }

  function goNext() {
    const nextIndex = nextUnanswered(answers);
    setFeedbackIndex(null);
    if (nextIndex === -1) return; // all answered → results view
    setCurrent(nextIndex);
    const { start, end } = paddedSegment(sentences, nextIndex);
    player.playSegment(start, end);
  }

  if (!progress) {
    return (
      <p role="status" className="mt-8 text-ink-muted">
        {t("loading")}
      </p>
    );
  }

  const saveError = saveFailed && (
    <p role="alert" className="mt-4 text-supporting text-error">
      {t("saveFailed")}
    </p>
  );

  if (done && feedbackIndex === null) {
    return (
      <DictationResult
        video={video}
        answers={answers}
        score={progress.days[day]?.score ?? 0}
        saveError={saveError}
      />
    );
  }

  const showing = feedbackIndex ?? current;
  const shownAnswer =
    feedbackIndex !== null ? (answers[feedbackIndex] ?? "") : "";
  const isLast = feedbackIndex !== null && nextUnanswered(answers) === -1;

  return (
    <div className="mt-8 space-y-8">
      <div>
        <YouTubeFrame {...player} />
        <CaptionHint />
      </div>

      <ProgressBar
        value={answeredCount}
        max={sentences.length}
        label={tProgress("today")}
      />

      <section className="space-y-6">
        <SentencePlayer player={player} sentences={sentences} index={showing} />

        {feedbackIndex === null ? (
          <form onSubmit={submit} className="space-y-3">
            <label htmlFor="dictation-input" className="sr-only">
              {t("inputLabel")}
            </label>
            <input
              id="dictation-input"
              ref={inputRef}
              lang="en"
              type="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t("placeholder")}
              className="w-full rounded-base border border-line bg-surface px-4 py-3 text-sentence focus-visible:border-accent"
            />
            <div className="flex flex-wrap items-center gap-4">
              <Button
                type="submit"
                variant="primary"
                arrow
                disabled={input.trim() === ""}
              >
                {t("submit")}
              </Button>
              <span className="text-supporting text-ink-muted">
                {t("enterHint")}
              </span>
            </div>
          </form>
        ) : (
          <div role="status" className="space-y-4">
            <WordDiffView
              diff={wordDiff(sentences[feedbackIndex].en, shownAnswer)}
            />
            <p className="text-supporting text-ink-muted">
              {t("sentenceScore", {
                score: format.number(
                  scoreDictation(sentences[feedbackIndex].en, shownAnswer)
                    .accuracy,
                  { style: "percent", maximumFractionDigits: 0 },
                ),
              })}
            </p>
            <Button ref={nextRef} variant="primary" arrow onClick={goNext}>
              {isLast ? t("seeResult") : t("next")}
            </Button>
          </div>
        )}
        {saveError}
      </section>

      <ol className="border-t border-line">
        {sentences.map((sentence, index) => {
          const answer = answers[index];
          const status =
            answer !== null && answer !== undefined
              ? "done"
              : index === current
                ? "current"
                : "pending";
          return (
            <li key={sentence.i}>
              <SentenceRow
                index={index}
                status={status}
                hidden={status !== "done"}
                score={
                  status === "done"
                    ? scoreDictation(sentence.en, answer ?? "").accuracy
                    : undefined
                }
              >
                {sentence.en}
              </SentenceRow>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function DictationResult({
  video,
  answers,
  score,
  saveError,
}: {
  video: Video;
  answers: readonly (string | null)[];
  score: number;
  saveError: React.ReactNode;
}) {
  const t = useTranslations("dictation");
  const format = useFormatter();

  return (
    <div className="mt-8 space-y-12">
      <div className="space-y-4">
        <ScoreBadge score={score} />
        <p className="font-display text-h3">{t("complete")}</p>
        {saveError}
      </div>

      <section>
        <h2 className="mb-6 font-display text-h2">{t("review")}</h2>
        <ol className="border-t border-line">
          {video.sentences.map((sentence, index) => {
            const answer = answers[index] ?? "";
            const accuracy = scoreDictation(sentence.en, answer).accuracy;
            return (
              <li
                key={sentence.i}
                className="grid gap-3 border-b border-line py-6 split:grid-cols-[3rem_1fr_auto]"
              >
                <span className="text-metadata text-ink-muted tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <WordDiffView diff={wordDiff(sentence.en, answer)} />
                <span className="text-supporting text-ink-muted tabular-nums">
                  {format.number(accuracy, {
                    style: "percent",
                    maximumFractionDigits: 0,
                  })}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <ButtonLink href={`/videos/${video.id}`} variant="secondary">
        {t("backToVideo")}
      </ButtonLink>
    </div>
  );
}

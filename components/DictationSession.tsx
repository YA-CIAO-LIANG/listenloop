"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { toLocalDate } from "@/lib/dates";
import {
  nextUnanswered,
  startDictation,
  submitAnswer,
  type DictationDay,
} from "@/lib/dictation";
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
import { SentenceRow } from "./SentenceRow";
import { useSentencePlayback } from "./useSentencePlayback";
import { WordDiffView } from "./WordDiffView";
import { YouTubeFrame } from "./youtube/YouTubeFrame";
import { useYouTubePlayer } from "./youtube/useYouTubePlayer";

/** How long "Skip" waits for the confirming second click. */
export const SKIP_CONFIRM_MS = 3000;

type DictationSessionProps = {
  video: Video;
  day: DictationDay;
  /** Page heading, e.g. "Day 1: Dictation". */
  title: string;
  /** Extra content shown below the practice area (intro text, credits). */
  children?: ReactNode;
  /** Injected in tests; defaults to localStorage. */
  store?: ProgressStore;
};

/** Ctrl+Space or Ctrl+Enter: replay (Ctrl+Enter is the Mac-friendly backup). */
const isReplayShortcut = (event: globalThis.KeyboardEvent) =>
  event.ctrlKey &&
  (event.key === "Enter" || event.key === " " || event.code === "Space");

/**
 * One-sentence-at-a-time dictation laid out so a whole sentence fits on one
 * screen: title row, progress, video (≤ 40% of the viewport), input, and a
 * row of Replay / Skip / Submit. Enter submits, shows the diff, and Enter
 * again moves on (the next sentence plays automatically). Every answer is
 * saved, so leaving and coming back resumes at the next sentence.
 */
export function DictationSession({
  video,
  day,
  title,
  children,
  store,
}: DictationSessionProps) {
  const t = useTranslations("dictation");
  const tProgress = useTranslations("practice.progress");
  const format = useFormatter();
  const player = useYouTubePlayer(video.youtubeId);
  const [progressStore] = useState(() => store ?? createLocalProgressStore());
  const [progress, setProgress] = useState<Progress | null>(null);
  const [current, setCurrent] = useState(0);
  // Index whose feedback is showing (after submit or skip, before "next").
  const [feedbackIndex, setFeedbackIndex] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [skipArmed, setSkipArmed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const skipTimer = useRef<number | undefined>(undefined);

  const { sentences } = video;
  const answers = progress?.days[day]?.answers ?? [];
  const answeredCount = answers.filter((a) => a !== null).length;
  const done = progress?.days[day]?.done ?? false;
  const showing = feedbackIndex ?? current;
  const playback = useSentencePlayback(player, sentences, showing);
  const practicing = progress !== null && !(done && feedbackIndex === null);

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

  // Grow the textarea with its content (one line by default).
  useLayoutEffect(() => {
    const element = inputRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [input, feedbackIndex, loaded]);

  // Replay shortcut works anywhere on the page while practicing. Capture
  // phase + preventDefault so it never types a space or clicks a button.
  const { play } = playback;
  useEffect(() => {
    if (!practicing) return;
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (!isReplayShortcut(event)) return;
      event.preventDefault();
      play();
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [practicing, play]);

  // A pending skip confirmation never carries over to another sentence.
  useEffect(() => {
    return () => window.clearTimeout(skipTimer.current);
  }, []);

  function record(answer: string) {
    if (!progress) return;
    const next = submitAnswer(
      progress,
      day,
      current,
      answer,
      sentences,
      toLocalDate(new Date()),
    );
    window.clearTimeout(skipTimer.current);
    setSkipArmed(false);
    setProgress(next);
    setFeedbackIndex(current);
    setInput("");
    void save(next);
  }

  function submitTyped() {
    if (input.trim() !== "") record(input.trim());
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter" ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    // Enter while an IME (e.g. Zhuyin) is composing confirms the candidate.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    submitTyped();
  }

  function skip() {
    if (!skipArmed) {
      setSkipArmed(true);
      skipTimer.current = window.setTimeout(
        () => setSkipArmed(false),
        SKIP_CONFIRM_MS,
      );
      return;
    }
    record(""); // a skipped sentence scores 0
  }

  function goNext() {
    const nextIndex = nextUnanswered(answers);
    setFeedbackIndex(null);
    if (nextIndex === -1) return; // all answered → results view
    setCurrent(nextIndex);
    playback.playAt(nextIndex);
  }

  // Phones: keep video, input, and buttons together above the keyboard.
  function onInputFocus() {
    if (window.matchMedia?.("(pointer: coarse)").matches) {
      videoRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
      <div>
        <Link
          href={`/videos/${video.id}`}
          className="text-supporting text-ink-muted hover:text-ink"
        >
          <span aria-hidden="true">← </span>
          <span lang="en">{video.title}</span>
        </Link>
        <h1 className="font-display text-h3">{title}</h1>
      </div>
      {practicing && (
        <p className="text-metadata tracking-widest text-ink-muted uppercase">
          {t("position", { n: showing + 1, total: sentences.length })}
        </p>
      )}
    </div>
  );

  const saveError = saveFailed && (
    <p role="alert" className="text-supporting text-error">
      {t("saveFailed")}
    </p>
  );

  if (!progress) {
    // Keep `children` (intro and video credit) visible while loading: the
    // credit must always show wherever the video is used.
    return (
      <>
        <div className="practice-column space-y-4">
          {header}
          <p role="status" className="text-ink-muted">
            {t("loading")}
          </p>
        </div>
        {children}
      </>
    );
  }

  if (!practicing) {
    return (
      <>
        <div className="practice-column space-y-4">{header}</div>
        <DictationResult
          video={video}
          answers={answers}
          score={progress.days[day]?.score ?? 0}
          saveError={saveError}
        />
        {children}
      </>
    );
  }

  const shownAnswer =
    feedbackIndex !== null ? (answers[feedbackIndex] ?? "") : "";
  const isLast = feedbackIndex !== null && nextUnanswered(answers) === -1;

  return (
    <>
      <section className="practice-column space-y-4">
        {header}
        <ProgressBar
          value={answeredCount}
          max={sentences.length}
          label={tProgress("today")}
        />

        <div ref={videoRef} className="scroll-mt-2">
          <YouTubeFrame {...player} />
          <CaptionHint />
        </div>

        {feedbackIndex === null ? (
          <div>
            <label htmlFor="dictation-input" className="sr-only">
              {t("inputLabel")}
            </label>
            <textarea
              id="dictation-input"
              ref={inputRef}
              lang="en"
              rows={1}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onInputKeyDown}
              onFocus={onInputFocus}
              placeholder={t("placeholder")}
              className="block w-full resize-none overflow-hidden rounded-base border border-line bg-surface px-4 py-3 text-sentence focus-visible:border-accent"
            />
          </div>
        ) : (
          <div role="status" className="space-y-2">
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
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            disabled={player.status !== "ready"}
            onClick={playback.play}
          >
            {playback.played ? t("replay") : t("play")}
          </Button>
          {feedbackIndex === null ? (
            <>
              <Button variant="ghost" onClick={skip} aria-live="polite">
                {skipArmed ? t("confirmSkip") : t("skip")}
              </Button>
              <Button
                variant="primary"
                arrow
                disabled={input.trim() === ""}
                onClick={submitTyped}
              >
                {t("submit")}
              </Button>
            </>
          ) : (
            <Button ref={nextRef} variant="primary" arrow onClick={goNext}>
              {isLast ? t("seeResult") : t("next")}
            </Button>
          )}
        </div>
        <p className="text-metadata text-ink-muted">{t("shortcuts")}</p>
        {saveError}
      </section>

      {children}

      <section className="practice-column mt-12">
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
      </section>
    </>
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
  saveError: ReactNode;
}) {
  const t = useTranslations("dictation");
  const format = useFormatter();

  return (
    <div className="practice-column mt-8 space-y-12">
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
                className="grid gap-3 border-b border-line py-6 split:grid-cols-[2rem_1fr_auto]"
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

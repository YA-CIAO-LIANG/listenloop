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
  attemptScore,
  emptyAnswers,
  nextUnanswered,
  recordAnswer,
  startDictation,
  submitAnswer,
  type Answers,
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
import { SentenceNotes } from "./SentenceNotes";
import { SentenceRow } from "./SentenceRow";
import { useSentencePlayback } from "./useSentencePlayback";
import { WeekResult } from "./WeekResult";
import { WordDiffView } from "./WordDiffView";
import { YouTubeFrame } from "./youtube/YouTubeFrame";
import { useYouTubePlayer } from "./youtube/useYouTubePlayer";

/** How long "Skip" waits for the confirming second click. */
export const SKIP_CONFIRM_MS = 3000;

/**
 * official: the first full run, saved and scored for the cycle.
 * retry: extra practice after the official run is done. Kept in memory only,
 * never saved, so it can't change the official score.
 */
type Mode = "official" | "retry";

type DictationSessionProps = {
  video: Video;
  day: DictationDay;
  /** Page heading, e.g. "Day 1: Dictation". */
  title: string;
  /** Start a retry right away if the official run is already done (?retry=1). */
  startInRetry?: boolean;
  /** Extra content shown below the practice area (intro text, credits). */
  children?: ReactNode;
  /** Injected in tests; defaults to localStorage. */
  store?: ProgressStore;
};

/** From this width the sentence notes sit beside the practice column. */
const WIDE_QUERY = "(min-width: 64rem)";

/** Narrow screens show the notes below the buttons, so we scroll for them. */
const isNarrow = () => window.matchMedia?.(WIDE_QUERY).matches === false;

function scrollToTop(element: HTMLElement | null) {
  const reduceMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  element?.scrollIntoView?.({
    block: "start",
    behavior: reduceMotion ? "auto" : "smooth",
  });
}

/** Ctrl+Space or Ctrl+Enter: replay (Ctrl+Enter is the Mac-friendly backup). */
const isReplayShortcut = (event: globalThis.KeyboardEvent) =>
  event.ctrlKey &&
  (event.key === "Enter" || event.key === " " || event.code === "Space");

/**
 * One-sentence-at-a-time dictation laid out so a whole sentence fits on one
 * screen: title, a sticky "Sentence N / M" bar, video (≤ 40% of the
 * viewport), input, and Replay / Skip / Submit. Enter submits, shows the
 * diff, and Enter again moves on (the next sentence plays automatically).
 * The official run is saved after every answer; once it's done, learners can
 * practice again without touching the official score.
 */
export function DictationSession({
  video,
  day,
  title,
  startInRetry = false,
  children,
  store,
}: DictationSessionProps) {
  const t = useTranslations("dictation");
  const format = useFormatter();
  const player = useYouTubePlayer(video.youtubeId);
  const [progressStore] = useState(() => store ?? createLocalProgressStore());
  const [progress, setProgress] = useState<Progress | null>(null);
  const [mode, setMode] = useState<Mode>("official");
  const [retryAnswers, setRetryAnswers] = useState<Answers>([]);
  const [current, setCurrent] = useState(0);
  // Index whose feedback is showing (after submit or skip, before "next").
  const [feedbackIndex, setFeedbackIndex] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [skipArmed, setSkipArmed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const skipTimer = useRef<number | undefined>(undefined);

  const { sentences } = video;
  const official = progress?.days[day];
  const officialScore = official?.score ?? 0;
  const answers: Answers =
    mode === "retry" ? retryAnswers : (official?.answers ?? []);
  const answeredCount = answers.filter((a) => a !== null).length;
  const attemptDone = answers.length > 0 && nextUnanswered(answers) === -1;
  const showing = feedbackIndex ?? current;
  const playback = useSentencePlayback(player, sentences, showing);
  const practicing =
    progress !== null && (feedbackIndex !== null || !attemptDone);
  const percent = (value: number) =>
    format.number(value, { style: "percent", maximumFractionDigits: 0 });

  async function save(next: Progress) {
    try {
      await progressStore.save(next);
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  }

  function beginRetry() {
    window.clearTimeout(skipTimer.current);
    setSkipArmed(false);
    setMode("retry");
    setRetryAnswers(emptyAnswers(sentences.length));
    setCurrent(0);
    setFeedbackIndex(null);
    setInput("");
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
      if (startInRetry && started.days[day]?.done) {
        beginRetry();
      } else {
        setCurrent(
          Math.max(0, nextUnanswered(started.days[day]?.answers ?? [])),
        );
      }
      if (started !== saved) void save(started);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per video/day
  }, [progressStore, video.id, day, sentences.length]);

  // Keyboard flow: focus "next" after submitting, the input otherwise.
  // `loaded` and `mode` matter: the input appears once progress has loaded,
  // and again when a retry starts from the results screen.
  const loaded = progress !== null;
  useEffect(() => {
    if (feedbackIndex !== null) nextRef.current?.focus();
    else inputRef.current?.focus();
  }, [loaded, mode, feedbackIndex, current]);

  // Narrow screens: after answering, bring feedback, buttons, and notes into
  // one screen (the video scrolls up; replay brings it back).
  useEffect(() => {
    if (feedbackIndex !== null && isNarrow()) scrollToTop(feedbackRef.current);
  }, [feedbackIndex]);

  // Grow the textarea with its content (one line by default).
  useLayoutEffect(() => {
    const element = inputRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [input, feedbackIndex, loaded, mode]);

  // Replay shortcut works anywhere on the page while practicing. Capture
  // phase + preventDefault so it never types a space or clicks a button.
  const { play } = playback;
  useEffect(() => {
    if (!practicing) return;
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (!isReplayShortcut(event)) return;
      event.preventDefault();
      replay(play);
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [practicing, play]);

  // A pending skip confirmation never outlives the page.
  useEffect(() => {
    return () => window.clearTimeout(skipTimer.current);
  }, []);

  function record(answer: string) {
    if (!progress) return;
    window.clearTimeout(skipTimer.current);
    setSkipArmed(false);
    if (mode === "retry") {
      setRetryAnswers((list) => recordAnswer(list, current, answer));
    } else {
      const next = submitAnswer(
        progress,
        day,
        current,
        answer,
        sentences,
        toLocalDate(new Date()),
      );
      setProgress(next);
      void save(next);
    }
    setFeedbackIndex(current);
    setInput("");
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

  // Phones and narrow windows: keep video, input, and buttons together
  // (above the keyboard on phones).
  function onInputFocus() {
    if (window.matchMedia?.("(pointer: coarse)").matches || isNarrow()) {
      scrollToTop(videoRef.current);
    }
  }

  // The video must be on screen while it plays (YouTube terms).
  function replay(playNow: () => void) {
    if (isNarrow()) scrollToTop(videoRef.current);
    playNow();
  }

  const header = (
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

  // Day 7's official completion is the week result (settled on finishing).
  if (
    !practicing &&
    day === 7 &&
    mode === "official" &&
    progress.status !== "in-progress"
  ) {
    return (
      <>
        <div className="practice-column space-y-4">{header}</div>
        <WeekResult video={video} progress={progress} store={progressStore} />
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
          mode={mode}
          answers={answers}
          score={
            mode === "retry" ? attemptScore(sentences, answers) : officialScore
          }
          officialScore={officialScore}
          onRetry={beginRetry}
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
      {/* Wide screens: notes beside the practice column, no scrolling. */}
      <div className="wide:mx-auto wide:flex wide:max-w-content wide:items-start wide:justify-center wide:gap-8">
        <section className="practice-column space-y-4 wide:practice-column-notes">
          {header}
          {mode === "retry" && (
            <p className="text-supporting text-accent-ink">
              {t("practiceMode", { score: percent(officialScore) })}
            </p>
          )}

          {/* Stays at the top while scrolling, so learners always see where they are. */}
          <div className="sticky top-0 z-10 bg-ground py-2">
            <ProgressBar
              value={answeredCount}
              max={sentences.length}
              label={t("position", { n: showing + 1, total: sentences.length })}
              showCount={false}
            />
          </div>

          <div ref={videoRef} className="scroll-mt-16">
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
            <div
              ref={feedbackRef}
              role="status"
              className="scroll-mt-16 space-y-2"
            >
              <WordDiffView
                diff={wordDiff(sentences[feedbackIndex].en, shownAnswer)}
              />
              <p className="text-supporting text-ink-muted">
                {t("sentenceScore", {
                  score: percent(
                    scoreDictation(sentences[feedbackIndex].en, shownAnswer)
                      .accuracy,
                  ),
                })}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              disabled={player.status !== "ready"}
              onClick={() => replay(() => playback.play())}
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

        {/* Below the buttons on narrow screens, so "next" stays put; a sticky
          column on wide screens, reserved before answering so nothing jumps. */}
        <div
          className={`practice-column wide:sticky wide:top-0 wide:mx-0 wide:mt-0 wide:w-80 wide:shrink-0 wide:pt-2 ${
            feedbackIndex !== null ? "mt-4" : ""
          }`}
        >
          {feedbackIndex !== null ? (
            <SentenceNotes video={video} index={feedbackIndex} />
          ) : (
            <p className="hidden text-supporting text-ink-muted wide:block">
              {t("notesHint")}
            </p>
          )}
        </div>
      </div>

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
  mode,
  answers,
  score,
  officialScore,
  onRetry,
  saveError,
}: {
  video: Video;
  mode: Mode;
  answers: Answers;
  /** The score to show: official for the first run, this attempt's for a retry. */
  score: number;
  officialScore: number;
  onRetry: () => void;
  saveError: ReactNode;
}) {
  const t = useTranslations("dictation");
  const tHandout = useTranslations("handout");
  const format = useFormatter();
  const percent = (value: number) =>
    format.number(value, { style: "percent", maximumFractionDigits: 0 });

  return (
    <div className="practice-column mt-8 space-y-12">
      <div className="space-y-4">
        {mode === "official" ? (
          <p className="text-supporting text-success">
            <span aria-hidden="true">✓ </span>
            {t("todayDone")} · {t("officialScore", { score: percent(score) })}
          </p>
        ) : (
          <p className="text-metadata tracking-widest text-ink-muted uppercase">
            {t("thisAttempt")}
          </p>
        )}
        <ScoreBadge score={score} />
        <p className="font-display text-h3">
          {mode === "official" ? t("complete") : t("retryComplete")}
        </p>
        {mode === "retry" && (
          <p className="text-supporting text-ink-muted">
            {t("officialUnchanged", { score: percent(officialScore) })}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" arrow onClick={onRetry}>
            {t("retry")}
          </Button>
          <ButtonLink href={`/videos/${video.id}/handout`} variant="secondary">
            {tHandout("open")}
          </ButtonLink>
          <ButtonLink href={`/videos/${video.id}`} variant="ghost">
            {t("backToVideo")}
          </ButtonLink>
        </div>
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
                  {percent(accuracy)}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

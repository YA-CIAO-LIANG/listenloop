"use client";

import { oneLineTitle } from "@/lib/titles";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { toLocalDate } from "@/lib/dates";
import { officialScore as countedScore } from "@/lib/cycle";
import {
  attemptScore,
  attemptWeightedScore,
  emptyAnswers,
  isBelowMinimum,
  nextUnanswered,
  recordAnswer,
  recordSpeed,
  restartDictation,
  startDictation,
  submitAnswer,
  type Answers,
  type DictationDay,
  type Speeds,
} from "@/lib/dictation";
import { passRulesOf } from "@/lib/pass-rules";
import { DEFAULT_SPEED, pace, type Pace, type Speed } from "@/lib/speed";
import { recordTask } from "@/lib/activity";
import { addMisses, sentenceMisses } from "@/lib/review";
import { perfectSentences } from "@/lib/score-points";
import { logOfficial, logRetry, updateActivity } from "@/lib/claim-rewards";
import type { Progress } from "@/lib/progress";
import { scoreDictation } from "@/lib/scoring/dictation";
import { wordDiff } from "@/lib/scoring/word-diff";
import type { ProgressStore } from "@/lib/storage/progress-store";
import { type PracticeMaterial } from "@/lib/practice-material";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";
import { PracticeSkeleton } from "./Skeleton";
import { PerfectCelebration } from "./PerfectCelebration";
import { usePlan } from "./PlanProvider";
import { can, needsCount, type PlanBlock } from "@/lib/plans";
import { PracticeActions, PracticeActionsSpacer } from "./PracticeActions";
import { PracticeFrame } from "./PracticeFrame";
import { HandsFreeSetting } from "./HandsFreeSetting";
import { HandsFreeStatus } from "./HandsFreeStatus";
import { useHandsFree } from "./useHandsFree";
import { ProgressBar } from "./ProgressBar";
import { QuizInvite } from "./QuizInvite";
import { RewardGainedNote } from "./RewardBadge";
import { ScoreBadge } from "./ScoreBadge";
import { Tag } from "./Tag";
import { ReportSentence } from "./ReportSentence";
import { SentenceExplanation } from "./SentenceExplanation";
import { missedPieces } from "@/lib/custom-practice/marks";
import { notesForSentence } from "@/lib/videos";
import { SentenceRow } from "./SentenceRow";
import { SpeedControl } from "./SpeedControl";
import { claimAndAnnounce } from "./useRewards";
import { FilterChip } from "./FilterChip";
import { useLoopingPlayback } from "./useLoopingPlayback";
import { useSentencePlayback } from "./useSentencePlayback";
import { usePracticeTimer } from "./usePracticeTimer";
import { useSentencePlayer } from "./useSentencePlayer";
import { WeekResult } from "./WeekResult";
import { WordDiffView } from "./WordDiffView";
import { useStores } from "./StoresProvider";
import { logClientEvent } from "./useEventLog";

/** How long "Skip" waits for the confirming second click. */
export const SKIP_CONFIRM_MS = 3000;

/**
 * official: the first full run, saved and scored for the cycle.
 * retry: extra practice after the official run is done. Kept in memory only,
 * never saved, so it can't change the official score.
 */
type Mode = "official" | "retry";

type DictationSessionProps = {
  video: PracticeMaterial;
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
  const tHands = useTranslations("handsFree");
  const format = useFormatter();
  // Audio practices only (D73); YouTube videos always play at 1×.
  const [speed, setSpeed] = useState<Speed>(DEFAULT_SPEED);
  const player = useSentencePlayer(video, speed);
  const heardAt = player.kind === "audio" ? speed : DEFAULT_SPEED;
  usePracticeTimer(video.id, player.isPlaying);
  const stores = useStores();
  const progressStore = store ?? stores.progress;
  const [progress, setProgress] = useState<Progress | null>(null);
  const [mode, setMode] = useState<Mode>("official");
  const [retryAnswers, setRetryAnswers] = useState<Answers>([]);
  const [retrySpeeds, setRetrySpeeds] = useState<Speeds>([]);
  const [current, setCurrent] = useState(0);
  // Index whose feedback is showing (after submit or skip, before "next").
  const [feedbackIndex, setFeedbackIndex] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [skipArmed, setSkipArmed] = useState(false);
  // Hands-free (D125): one tap on "Start practice" lets the sound play.
  const [handsFree] = useHandsFree();
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const plan = usePlan();
  const tPlans = useTranslations("plans");
  const [blocked, setBlocked] = useState<PlanBlock | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const skipTimer = useRef<number | undefined>(undefined);

  const { sentences } = video;
  const official = progress?.days[day];
  // What the day counts with: weighted by speed (D73).
  const officialScore = (official && countedScore(official)) ?? 0;
  const answers: Answers =
    mode === "retry" ? retryAnswers : (official?.answers ?? []);
  const speeds: Speeds =
    mode === "retry" ? retrySpeeds : (official?.speeds ?? []);
  const answeredCount = answers.filter((a) => a !== null).length;
  const attemptDone = answers.length > 0 && nextUnanswered(answers) === -1;
  const showing = feedbackIndex ?? current;
  const playback = useSentencePlayback(player, showing);
  // Loop (D90): the current sentence again and again until it's answered.
  const looping = useLoopingPlayback(
    playback.playAt,
    showing,
    progress !== null && feedbackIndex === null && !attemptDone,
  );
  const practicing =
    progress !== null && (feedbackIndex !== null || !attemptDone);
  const percent = (value: number) =>
    format.number(value, { style: "percent", maximumFractionDigits: 0 });

  async function save(next: Progress) {
    // The official day just finished: log it once, with its score (D55).
    const justFinished =
      progress !== null && !progress.days[day]?.done && next.days[day]?.done;
    try {
      await progressStore.save(next);
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
      return;
    }
    if (justFinished) {
      logClientEvent({
        type: "day_complete",
        videoId: video.id,
        day,
        score: next.days[day]?.score ?? null,
      });
    }
    if (next.days[day]?.done) {
      const today = toLocalDate(new Date());
      // The words misheard today go on the review list (D108), once.
      const misses = justFinished
        ? (next.days[day]?.answers ?? []).flatMap((answer, i) =>
            typeof answer === "string" && sentences[i]
              ? sentenceMisses(
                  {
                    en: sentences[i].en,
                    zh: sentences[i].zh,
                    videoId: video.id,
                    i,
                    // A recording's URL is signed and short-lived (D130).
                    ...(video.audioUrls?.[i] && !video.audioClips
                      ? { audio: video.audioUrls[i] }
                      : {}),
                  },
                  answer,
                )
              : [],
          )
        : [];
      // Practice history for the home calendar (kept even with rewards off).
      void updateActivity(stores.rewards, (activity) => {
        const logged = recordTask(activity, today, {
          videoId: video.id,
          week: next.week,
          day,
          perfect: perfectSentences(next.days[day], sentences),
        });
        return misses.length
          ? {
              ...logged,
              review: addMisses(logged.review ?? {}, misses, today, new Date()),
            }
          : logged;
      }).catch(() => {});
      // A finished official day earns points and today's feed.
      void claimAndAnnounce({ progress: progressStore }, logOfficial(today));
    }
  }

  /** A finished retry earns its (once a day) bonus. */
  function claimRetry() {
    void claimAndAnnounce(
      { progress: progressStore },
      logRetry(toLocalDate(new Date()), video.id),
    );
  }

  function beginRetry() {
    logClientEvent({ type: "retry", videoId: video.id, day });
    window.clearTimeout(skipTimer.current);
    setSkipArmed(false);
    setMode("retry");
    setRetryAnswers(emptyAnswers(sentences.length));
    setRetrySpeeds(sentences.map(() => null));
    setCurrent(0);
    setFeedbackIndex(null);
    setInput("");
  }

  // Load saved progress (or start fresh) once, in the browser.
  useEffect(() => {
    let cancelled = false;
    progressStore.get(video.id).then(async (saved) => {
      if (cancelled) return;
      // Starting a new practice may be limited by the plan (D54).
      if (!saved && needsCount(plan, "start-practice")) {
        const all = await progressStore.list();
        const active = all.filter((p) => p.status === "in-progress").length;
        const allowed = can(plan, { kind: "start-practice", active });
        if (!allowed.ok) {
          if (!cancelled) setBlocked(allowed);
          return;
        }
      }
      if (cancelled) return;
      const started = startDictation(
        saved,
        video.id,
        day,
        sentences.length,
        toLocalDate(new Date()),
        video.version,
      );
      setProgress(started);
      if (!saved) {
        logClientEvent({ type: "practice_start", videoId: video.id, day });
      }
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
  const { start: startPlaying } = looping;
  const play = useCallback(
    () => startPlaying(showing),
    [startPlaying, showing],
  );
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

  // The first sentence plays by itself once the player is ready (D90). The
  // browser may block sound before any tap on the page; then the Play
  // button is there as before.
  const autoPlayed = useRef(false);
  const ready = player.status === "ready";
  useEffect(() => {
    if (autoPlayed.current || !ready || !practicing || handsFree) return;
    if (feedbackIndex !== null) return;
    autoPlayed.current = true;
    play();
  }, [ready, practicing, feedbackIndex, play, handsFree]);

  /** Hands-free (D125): the tap the browser needs before any sound. */
  function startPractice() {
    autoPlayed.current = true;
    setStarted(true);
    setPaused(false);
    replay(play);
    inputRef.current?.focus();
  }

  function togglePause() {
    if (paused) {
      setPaused(false);
      if (feedbackIndex === null) replay(play);
      return;
    }
    setPaused(true);
    looping.setLoop(false);
    player.stop();
  }

  // A pending skip confirmation never outlives the page.
  useEffect(() => {
    return () => window.clearTimeout(skipTimer.current);
  }, []);

  function record(answer: string) {
    if (!progress) return;
    window.clearTimeout(skipTimer.current);
    setSkipArmed(false);
    if (mode === "retry") {
      const next = recordAnswer(retryAnswers, current, answer);
      setRetryAnswers(next);
      setRetrySpeeds(
        recordSpeed(retrySpeeds, current, heardAt, sentences.length),
      );
      if (next !== retryAnswers && nextUnanswered(next) === -1) claimRetry();
    } else {
      const next = submitAnswer(
        progress,
        day,
        current,
        answer,
        sentences,
        toLocalDate(new Date()),
        heardAt,
      );
      setProgress(next);
      void save(next);
    }
    setFeedbackIndex(current);
    setInput("");
    // Answering counts as starting (the learner may type before tapping).
    setStarted(true);
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
    // Paused hands-free practice waits for "Play" (D125).
    if (!(handsFree && paused)) looping.start(nextIndex);
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
        className="tap text-supporting text-ink-muted hover:text-ink"
      >
        <span aria-hidden="true">← </span>
        <span>
          {oneLineTitle({ en: video.title, zh: video.titleZh ?? null })}
        </span>
      </Link>
      <h1 className="font-display text-h3">{title}</h1>
    </div>
  );

  const saveError = saveFailed && (
    <p role="alert" className="text-supporting text-error">
      {t("saveFailed")}
    </p>
  );

  if (blocked) {
    return (
      <>
        <div className="practice-column space-y-4">
          {header}
          <p role="alert" className="text-error">
            {tPlans(`limits.${blocked.limit}`, { max: blocked.max ?? 0 })}
          </p>
          <ButtonLink href="/practices" variant="secondary">
            {tPlans("seePractices")}
          </ButtonLink>
        </div>
        {children}
      </>
    );
  }

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
          <PracticeSkeleton audio={!!video.audioUrls} />
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

  // Every answer is in but short of the practice's minimum (D92): the day
  // isn't done; dictate it again.
  if (!practicing && mode === "official" && isBelowMinimum(progress, day)) {
    const restart = () => {
      const next = restartDictation(progress, day);
      setProgress(next);
      void save(next);
      setCurrent(0);
      setFeedbackIndex(null);
      looping.start(0);
    };
    return (
      <>
        <div className="practice-column space-y-4">{header}</div>
        <div className="practice-column mt-8 space-y-4">
          <ScoreBadge score={officialScore} />
          <p role="status" className="font-display text-h3">
            {t("belowMinimum", {
              score: percent(officialScore),
              min: percent(passRulesOf(progress).dictationMin),
            })}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" arrow onClick={restart}>
              {t("dictateAgain")}
            </Button>
            <ButtonLink href={`/videos/${video.id}#pass-rules`} variant="ghost">
              {t("changeRules")}
            </ButtonLink>
          </div>
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
          day={day}
          mode={mode}
          answers={answers}
          score={
            mode === "retry"
              ? attemptWeightedScore(sentences, answers, speeds)
              : officialScore
          }
          rawScore={
            mode === "retry"
              ? attemptScore(sentences, answers)
              : (official?.score ?? 0)
          }
          pace={pace(
            sentences.map((s, i) => scoreDictation(s.en, answers[i] ?? "")),
            speeds,
          )}
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
  const feedbackAccuracy =
    feedbackIndex !== null
      ? scoreDictation(sentences[feedbackIndex].en, shownAnswer).accuracy
      : 0;
  const isLast = feedbackIndex !== null && nextUnanswered(answers) === -1;

  return (
    <>
      {/* Wide screens: notes beside the practice column, no scrolling. */}
      <div>
        <section className="practice-column space-y-4">
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
            <PracticeFrame player={player} />
          </div>
          {player.kind === "audio" && (
            <SpeedControl value={speed} onChange={setSpeed} />
          )}

          {handsFree && (
            <HandsFreeStatus
              state={
                !started
                  ? "start"
                  : paused
                    ? "paused"
                    : player.isPlaying
                      ? "playing"
                      : feedbackIndex === null
                        ? "type"
                        : null
              }
            />
          )}
          {/* The answer area keeps one height, so the buttons below stay
              put from sentence to sentence (D124). */}
          {feedbackIndex === null ? (
            <div className="min-h-36">
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
              className="relative min-h-36 scroll-mt-16 space-y-2"
            >
              <WordDiffView
                diff={wordDiff(sentences[feedbackIndex].en, shownAnswer)}
              />
              {/* The meaning right under the sentence (D78). */}
              <p className="text-supporting text-ink-muted">
                {sentences[feedbackIndex].zh}
              </p>
              <p className="text-supporting text-ink-muted">
                {t("sentenceScore", { score: percent(feedbackAccuracy) })}
                {/* Feedback only shows right after a submit, so this plays once per answer. */}
                {feedbackAccuracy === 1 && (
                  <PerfectCelebration key={`${mode}:${feedbackIndex}`} />
                )}
              </p>
            </div>
          )}

          <PracticeActions
            primary={
              feedbackIndex === null &&
              handsFree &&
              !started &&
              input.trim() === "" ? (
                <Button
                  variant="primary"
                  arrow
                  disabled={player.status !== "ready"}
                  onClick={startPractice}
                >
                  {tHands("start")}
                </Button>
              ) : feedbackIndex === null ? (
                <Button
                  variant="primary"
                  arrow
                  disabled={input.trim() === ""}
                  onClick={submitTyped}
                >
                  {t("submit")}
                </Button>
              ) : (
                <Button ref={nextRef} variant="primary" arrow onClick={goNext}>
                  {isLast ? t("seeResult") : t("next")}
                </Button>
              )
            }
          >
            <Button
              variant="secondary"
              disabled={player.status !== "ready"}
              onClick={() => replay(play)}
            >
              {playback.played ? t("replay") : t("play")}
            </Button>
            <FilterChip
              on={looping.loop}
              onToggle={() => {
                looping.setLoop(!looping.loop);
                if (!looping.loop && feedbackIndex === null) replay(play);
              }}
            >
              {t("loop")}
            </FilterChip>
            {feedbackIndex === null && (
              <Button variant="ghost" onClick={skip} aria-live="polite">
                {skipArmed ? t("confirmSkip") : t("skip")}
              </Button>
            )}
            {handsFree && started && (
              <Button variant="ghost" onClick={togglePause}>
                {paused ? tHands("resume") : tHands("pause")}
              </Button>
            )}
          </PracticeActions>
          <p className="text-metadata text-ink-muted pointer-coarse:hidden">
            {t("shortcuts")}
          </p>
          <HandsFreeSetting compact />
          {saveError}
          {feedbackIndex !== null && (
            <div
              role="region"
              aria-label={t("notesLabel")}
              className="space-y-4 border-t border-line pt-6"
            >
              {/* Reporting sits at the top of every sentence's notes, in
                  the same place each time (D124). */}
              <div className="flex justify-end">
                <ReportSentence
                  key={feedbackIndex}
                  videoId={video.id}
                  version={video.version}
                  index={feedbackIndex}
                />
              </div>
              {/* What was misheard first, highlighted (D68); the meaning is
                  already under the sentence above (D78). */}
              <SentenceExplanation
                en={sentences[feedbackIndex].en}
                zh={sentences[feedbackIndex].zh}
                showZh={false}
                rich={video.richNotes?.[feedbackIndex] ?? null}
                legacy={notesForSentence(video, feedbackIndex)}
                missed={missedPieces(sentences[feedbackIndex].en, shownAnswer)}
              />
            </div>
          )}
        </section>
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
      <PracticeActionsSpacer />
    </>
  );
}

function DictationResult({
  video,
  day,
  mode,
  answers,
  score,
  rawScore,
  pace: heardPace,
  officialScore,
  onRetry,
  saveError,
}: {
  video: PracticeMaterial;
  /** Day 1 or Day 7: which day's quiz to offer (D136). */
  day: number;
  mode: Mode;
  answers: Answers;
  /**
   * The score to show, weighted by speed (D73): official for the first
   * run, this attempt's for a retry.
   */
  score: number;
  /** The same without the speed weights, shown when they differ. */
  rawScore: number;
  pace: Pace | null;
  officialScore: number;
  onRetry: () => void;
  saveError: ReactNode;
}) {
  const t = useTranslations("dictation");
  const tSpeed = useTranslations("speed");
  const tHandout = useTranslations("handout");
  const tListen = useTranslations("listen");
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
        <RewardGainedNote />
        <ScoreBadge score={score} />
        {heardPace && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-supporting text-ink-muted">
            <Tag>{tSpeed(heardPace)}</Tag>
            {Math.abs(rawScore - score) > 1e-9 &&
              tSpeed("raw", { score: percent(rawScore) })}
          </p>
        )}
        <p className="font-display text-h3">
          {mode === "official" ? t("complete") : t("retryComplete")}
        </p>
        {mode === "retry" && (
          <p className="text-supporting text-ink-muted">
            {t("officialUnchanged", { score: percent(officialScore) })}
          </p>
        )}
        {/* The vocabulary quiz, which can be skipped (D136). */}
        <QuizInvite videoId={video.id} day={day === 7 ? 7 : 1} />
        <div className="flex flex-wrap items-center gap-3">
          {/* Secondary: the quiz above is the next step, one primary
              button per view (D170). */}
          <Button variant="secondary" arrow onClick={onRetry}>
            {t("retry")}
          </Button>
          <ButtonLink href={`/videos/${video.id}/handout`} variant="secondary">
            {tHandout("open")}
          </ButtonLink>
          <ButtonLink href={`/videos/${video.id}/listen`} variant="secondary">
            {tListen("open")}
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
                <div className="space-y-1">
                  <WordDiffView diff={wordDiff(sentence.en, answer)} />
                  {/* The meaning right under the sentence (D78). */}
                  <p className="text-supporting text-ink-muted">
                    {sentence.zh}
                  </p>
                </div>
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

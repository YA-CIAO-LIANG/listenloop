"use client";

import { oneLineTitle } from "@/lib/titles";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { toLocalDate } from "@/lib/dates";
import { recordTask } from "@/lib/activity";
import { logOfficial, logRetry, updateActivity } from "@/lib/claim-rewards";
import type { Progress } from "@/lib/progress";
import { scoreShadowing } from "@/lib/scoring/shadowing";
import { wordDiff } from "@/lib/scoring/word-diff";
import {
  averageCoverage,
  emptySentenceRecords,
  nextUnfinished,
  recordAttempt,
  startShadowing,
  submitShadowing,
  type SentenceRecords,
  type ShadowingAttempt,
  type ShadowingDay,
} from "@/lib/shadowing";
import {
  browserLabel,
  isStuck,
  TROUBLE_ATTEMPTS,
  TROUBLE_COVERAGE,
  type TroubleAttempt,
} from "@/lib/shadowing-trouble";
import type { ProgressStore } from "@/lib/storage/progress-store";
import { reportShadowingTrouble } from "@/app/videos/shadowing-actions";
import { type PracticeMaterial } from "@/lib/practice-material";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";
import { PracticeSkeleton } from "./Skeleton";
import { Dialog } from "./Dialog";
import { PerfectCelebration } from "./PerfectCelebration";
import { NextDayNote } from "./NextDayNote";
import { SentenceExplanation } from "./SentenceExplanation";
import { missedPieces } from "@/lib/custom-practice/marks";
import { notesForSentence } from "@/lib/videos";
import { ProgressBar } from "./ProgressBar";
import { RewardGainedNote } from "./RewardBadge";
import {
  BLOCKING_ERRORS,
  useSpeechRecognition,
  type SpeechError,
} from "./speech/useSpeechRecognition";
import { claimAndAnnounce } from "./useRewards";
import { useSentencePlayback } from "./useSentencePlayback";
import { usePracticeTimer } from "./usePracticeTimer";
import { useSentencePlayer } from "./useSentencePlayer";
import { PracticeFrame } from "./PracticeFrame";
import { SpeedControl } from "./SpeedControl";
import { DEFAULT_SPEED, type Speed } from "@/lib/speed";
import { useStores } from "./StoresProvider";
import { logClientEvent } from "./useEventLog";

/** official: saved for the cycle. retry: extra practice, kept in memory only. */
type Mode = "official" | "retry";

/** Where the current sentence is in its play → listen → result loop. */
type Phase = "ready" | "playing" | "listening" | "result";

type LastResult = { heard: string; coverage: number; complete: boolean };

type ShadowingSessionProps = {
  video: PracticeMaterial;
  day: ShadowingDay;
  title: string;
  /** Start a retry right away if today's run is already done (?retry=1). */
  startInRetry?: boolean;
  /** Extra content below the practice area (intro, credits). */
  children?: ReactNode;
  /** Injected in tests; defaults to localStorage. */
  store?: ProgressStore;
  /** Injected in tests; the Server Action otherwise (D52). */
  reportTrouble?: typeof reportShadowingTrouble;
};

/** Ctrl+Space or Ctrl+Enter: replay (Ctrl+Enter is the Mac-friendly backup). */
const isReplayShortcut = (event: globalThis.KeyboardEvent) =>
  event.ctrlKey &&
  (event.key === "Enter" || event.key === " " || event.code === "Space");

/**
 * Shadowing (Days 2–6): "Play and shadow" plays the sentence, then listens
 * automatically and ends after a short pause. 70% coverage or more completes
 * the sentence (missed words are underlined); otherwise try again, as often
 * as needed. Without speech recognition (unsupported, Brave, mic blocked,
 * repeated network errors), learners
 * listen, say it, and press "I said it".
 */
export function ShadowingSession({
  video,
  day,
  title,
  startInRetry = false,
  children,
  store,
  reportTrouble = reportShadowingTrouble,
}: ShadowingSessionProps) {
  const t = useTranslations("shadowing");
  const tHandout = useTranslations("handout");
  const format = useFormatter();
  // Audio practices can slow down or speed up (D73); videos stay at 1×.
  const [speed, setSpeed] = useState<Speed>(DEFAULT_SPEED);
  const player = useSentencePlayer(video, speed);
  usePracticeTimer(video.id, player.isPlaying);
  const speech = useSpeechRecognition();
  const stores = useStores();
  const progressStore = store ?? stores.progress;
  const [progress, setProgress] = useState<Progress | null>(null);
  const [mode, setMode] = useState<Mode>("official");
  const [retryRecords, setRetryRecords] = useState<SentenceRecords>([]);
  const [current, setCurrent] = useState(0);
  const [rawPhase, setPhase] = useState<Phase>("ready");
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  // This sentence's recent failed attempts, for the trouble dialog (D52).
  const troubleRef = useRef<TroubleAttempt[]>([]);
  const [troubleOpen, setTroubleOpen] = useState(false);
  // Each result plays its own celebration.
  const [resultCount, setResultCount] = useState(0);
  const nextRef = useRef<HTMLButtonElement>(null);

  const { sentences } = video;
  const official = progress?.days[day];
  const records: SentenceRecords =
    mode === "retry" ? retryRecords : (official?.sentences ?? []);
  const doneCount = records.filter((r) => r.done).length;
  const allDone = records.length > 0 && nextUnfinished(records) === -1;
  // A failed attempt (no speech, mic blocked…) goes back to "ready".
  const phase =
    rawPhase === "listening" && speech.status === "error" ? "ready" : rawPhase;
  const showingResult = phase === "result" && lastResult !== null;
  const practicing = progress !== null && (!allDone || showingResult);
  // Errors that retrying can't fix switch to "I said it" (manual) mode.
  const notice: SpeechError | null =
    speech.error && BLOCKING_ERRORS.includes(speech.error)
      ? speech.error
      : speech.availability === "unsupported" || speech.availability === "brave"
        ? speech.availability
        : null;
  const manual = notice !== null;
  const transientError =
    phase === "ready" && speech.status === "error" && !manual
      ? speech.error
      : null;
  const playback = useSentencePlayback(player, current);
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
        score: averageCoverage(next.days[day]?.sentences ?? []),
      });
    }
    if (next.days[day]?.done) {
      const today = toLocalDate(new Date());
      // Practice history for the home calendar (kept even with rewards off).
      void updateActivity(stores.rewards, (activity) =>
        recordTask(activity, today, {
          videoId: video.id,
          week: next.week,
          day,
        }),
      ).catch(() => {});
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
    speech.reset();
    setMode("retry");
    setRetryRecords(emptySentenceRecords(sentences.length));
    setCurrent(0);
    setPhase("ready");
    setLastResult(null);
  }

  // Load saved progress (or start fresh) once, in the browser.
  useEffect(() => {
    let cancelled = false;
    progressStore.get(video.id).then((saved) => {
      if (cancelled) return;
      const started = startShadowing(
        saved,
        video.id,
        day,
        sentences.length,
        toLocalDate(new Date()),
        video.version,
      );
      setProgress(started);
      if (startInRetry && started.days[day]?.done) beginRetry();
      else {
        setCurrent(
          Math.max(0, nextUnfinished(started.days[day]?.sentences ?? [])),
        );
      }
      if (started !== saved) void save(started);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per video/day
  }, [progressStore, video.id, day, sentences.length]);

  // Each recognition failure, once per sentence and kind (D55).
  const loggedFailures = useRef(new Set<string>());
  useEffect(() => {
    if (!speech.error) return;
    const key = `${current}:${speech.error}`;
    if (loggedFailures.current.has(key)) return;
    loggedFailures.current.add(key);
    logClientEvent({
      type: "recognition_fail",
      videoId: video.id,
      day,
      code: speech.error,
    });
  }, [speech.error, current, video.id, day]);

  // After a passing result, focus "next" so Enter continues.
  useEffect(() => {
    if (showingResult && lastResult?.complete) nextRef.current?.focus();
  }, [showingResult, lastResult]);

  // Replay shortcut while practicing (never while listening).
  const { play } = playback;
  useEffect(() => {
    if (!practicing) return;
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (!isReplayShortcut(event)) return;
      event.preventDefault();
      if (phase !== "listening") play();
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [practicing, phase, play]);

  // The first sentence plays by itself once (D90), without the microphone:
  // listening starts only when the learner presses the shadow button, so
  // the permission prompt never appears on its own.
  const autoPlayed = useRef(false);
  const ready = player.status === "ready";
  useEffect(() => {
    if (autoPlayed.current || !ready || !practicing || showingResult) return;
    autoPlayed.current = true;
    play();
  }, [ready, practicing, showingResult, play]);

  function record(index: number, attempt: ShadowingAttempt) {
    if (!progress) return;
    if (mode === "retry") {
      const next = recordAttempt(retryRecords, index, attempt);
      setRetryRecords(next);
      if (next !== retryRecords && nextUnfinished(next) === -1) claimRetry();
      return;
    }
    const next = submitShadowing(
      progress,
      day,
      index,
      attempt,
      toLocalDate(new Date()),
    );
    setProgress(next);
    if (next !== progress) void save(next);
  }

  /** Play the sentence, then (unless in manual mode) listen automatically. */
  function attempt(index: number) {
    if (index !== current) troubleRef.current = [];
    setCurrent(index);
    setLastResult(null);
    setPhase("playing");
    playback.playAt(index, () => {
      if (manual) {
        setPhase("ready");
        return;
      }
      setPhase("listening");
      speech.start((heard) => {
        const result = scoreShadowing(sentences[index].en, heard);
        record(index, { coverage: result.coverage });
        setLastResult({
          heard,
          coverage: result.coverage,
          complete: result.complete,
        });
        setResultCount((count) => count + 1);
        setPhase("result");
        const tries =
          result.coverage >= TROUBLE_COVERAGE
            ? []
            : [...troubleRef.current, { coverage: result.coverage, heard }];
        troubleRef.current = tries;
        if (isStuck(tries)) setTroubleOpen(true);
      });
    });
  }

  function goNext() {
    const nextIndex = nextUnfinished(records);
    setLastResult(null);
    setPhase("ready");
    if (nextIndex === -1) return; // all done → results view
    attempt(nextIndex);
  }

  /**
   * The trouble dialog's answer (D52): either way the attempts are
   * reported; skipping also marks the sentence done and moves on.
   */
  function resolveTrouble(skipped: boolean) {
    const attempts = troubleRef.current;
    troubleRef.current = [];
    setTroubleOpen(false);
    void reportTrouble({
      videoId: video.id,
      materialVersion: video.version ?? null,
      sentenceIndex: current,
      attempts,
      browser: browserLabel(navigator.userAgent),
      skipped,
    }).catch(() => {});
    if (!skipped) return;
    logClientEvent({ type: "sentence_skip", videoId: video.id, day });
    record(current, { skipped: true });
    const after = recordAttempt(records, current, { skipped: true });
    const nextIndex = nextUnfinished(after);
    setLastResult(null);
    setPhase("ready");
    if (nextIndex !== -1) setCurrent(nextIndex);
  }

  function markSaidIt() {
    record(current, { manual: true });
    const after = recordAttempt(records, current, { manual: true });
    const nextIndex = nextUnfinished(after);
    setLastResult(null);
    setPhase("ready");
    if (nextIndex !== -1) setCurrent(nextIndex);
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

  if (!progress) {
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

  if (!practicing) {
    const average = averageCoverage(records);
    return (
      <>
        <div className="practice-column space-y-4">{header}</div>
        <div className="practice-column mt-8 space-y-12">
          <div className="space-y-4">
            {mode === "official" ? (
              <p className="text-supporting text-success">
                <span aria-hidden="true">✓ </span>
                {t("todayDone")}
              </p>
            ) : null}
            <RewardGainedNote />
            <p className="font-display text-h3">
              {mode === "official" ? t("complete") : t("retryComplete")}
            </p>
            <p className="text-ink-muted">
              {t("sentencesDone", {
                done: doneCount,
                total: sentences.length,
              })}
              {average !== null && (
                <> · {t("average", { score: percent(average) })}</>
              )}
            </p>
            {mode === "official" && (
              <NextDayNote videoId={video.id} day={day} progress={progress} />
            )}
            {mode === "retry" && (
              <p className="text-supporting text-ink-muted">
                {t("recordUnchanged")}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" arrow onClick={beginRetry}>
                {t("retry")}
              </Button>
              <ButtonLink
                href={`/videos/${video.id}/handout`}
                variant="secondary"
              >
                {tHandout("open")}
              </ButtonLink>
              <ButtonLink href={`/videos/${video.id}`} variant="ghost">
                {t("backToVideo")}
              </ButtonLink>
            </div>
            {saveError}
          </div>
          <RecordList video={video} records={records} />
        </div>
        {children}
      </>
    );
  }

  const sentence = sentences[current];
  const diff =
    showingResult && lastResult
      ? wordDiff(sentence.en, lastResult.heard).reference
      : null;
  // The passing attempt is already recorded, so nothing left means last.
  const isLast = nextUnfinished(records) === -1;

  return (
    <>
      <section className="practice-column space-y-4">
        {header}
        {mode === "retry" && (
          <p className="text-supporting text-accent-ink">{t("practiceMode")}</p>
        )}

        <div className="sticky top-0 z-10 bg-ground py-2">
          <ProgressBar
            value={doneCount}
            max={sentences.length}
            label={t("position", { n: current + 1, total: sentences.length })}
            showCount={false}
          />
        </div>

        {notice && (
          <div
            role="alert"
            className="rounded-base border border-line bg-surface p-4"
          >
            <p className="text-supporting text-error">
              {t(`errors.${notice}Title` as "errors.unsupportedTitle")}
            </p>
            <p className="mt-1 text-supporting">
              {t(`errors.${notice}` as "errors.unsupported")}
            </p>
          </div>
        )}

        <div className="scroll-mt-16">
          <PracticeFrame player={player} />
        </div>
        {player.kind === "audio" && (
          <SpeedControl value={speed} onChange={setSpeed} showWeights={false} />
        )}

        <div className="space-y-2">
          <p lang="en" className="text-sentence">
            {diff
              ? diff.map((word, index) => (
                  <Fragment key={index}>
                    {index > 0 && " "}
                    {word.ok ? (
                      word.text
                    ) : (
                      <span className="text-error underline decoration-2 underline-offset-4">
                        {word.text}
                        <span className="sr-only">{t("missed")}</span>
                      </span>
                    )}
                  </Fragment>
                ))
              : sentence.en}
          </p>
          {/* The meaning right under the sentence, for every material (D78). */}
          <p className="mt-1 text-supporting text-ink-muted">{sentence.zh}</p>
        </div>

        {video.audioUrls && (
          <div className="border-t border-line pt-6">
            {/* After an attempt, the words not said are highlighted (D68). */}
            <SentenceExplanation
              en={sentence.en}
              zh={sentence.zh}
              showZh={false}
              rich={video.richNotes?.[current] ?? null}
              legacy={notesForSentence(video, current)}
              missed={
                showingResult && lastResult
                  ? missedPieces(sentence.en, lastResult.heard)
                  : null
              }
              showSentence={!!video.richNotes?.[current]?.highlights.length}
            />
          </div>
        )}

        <div aria-live="polite" className="relative space-y-1">
          {phase === "listening" && (
            <p className="text-supporting text-accent-ink">
              <span aria-hidden="true">● </span>
              {t("listening")}
            </p>
          )}
          {(phase === "listening" || showingResult) &&
            (speech.transcript || lastResult?.heard) && (
              <p className="text-supporting text-ink-muted">
                {t("heard")}{" "}
                <span lang="en">{lastResult?.heard ?? speech.transcript}</span>
              </p>
            )}
          {showingResult && lastResult && (
            <p
              className={`text-supporting ${
                lastResult.complete ? "text-success" : "text-ink"
              }`}
            >
              {lastResult.complete && <span aria-hidden="true">✓ </span>}
              {lastResult.complete ? `${t("passed")} · ` : ""}
              {t("coverage", { score: percent(lastResult.coverage) })}
              {!lastResult.complete && <> · {t("notYet")}</>}
              {lastResult.coverage === 1 && (
                <PerfectCelebration key={resultCount} />
              )}
            </p>
          )}
          {transientError && (
            <p className="text-supporting text-error">
              {t(`errors.${transientError}`)}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {manual ? (
            <>
              <Button
                variant="secondary"
                disabled={player.status !== "ready"}
                onClick={() => playback.play()}
              >
                {t("play")}
              </Button>
              <Button variant="primary" onClick={markSaidIt}>
                {t("iSaidIt")}
              </Button>
            </>
          ) : phase === "playing" ? (
            <Button variant="primary" disabled>
              {t("playing")}
            </Button>
          ) : phase === "listening" ? (
            <Button variant="secondary" onClick={speech.stop}>
              {t("stop")}
            </Button>
          ) : showingResult && lastResult?.complete ? (
            <Button ref={nextRef} variant="primary" arrow onClick={goNext}>
              {isLast ? t("seeResult") : t("next")}
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={player.status !== "ready"}
              onClick={() => attempt(current)}
            >
              {showingResult ? t("tryAgain") : t("playAndShadow")}
            </Button>
          )}
        </div>
        <p className="text-metadata text-ink-muted pointer-coarse:hidden">
          {t("shortcuts")}
        </p>
        {saveError}
        {troubleOpen && (
          <Dialog
            title={t("trouble.title")}
            onClose={() => resolveTrouble(false)}
          >
            <p>{t("trouble.intro", { count: TROUBLE_ATTEMPTS })}</p>
            <ul className="list-disc space-y-1 pl-5 text-supporting">
              {(["mic", "quiet", "chrome", "pace"] as const).map((tip) => (
                <li key={tip}>{t(`trouble.tips.${tip}`)}</li>
              ))}
            </ul>
            <p className="text-supporting text-ink-muted">
              {t("trouble.note")}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" onClick={() => resolveTrouble(false)}>
                {t("trouble.retry")}
              </Button>
              <Button variant="secondary" onClick={() => resolveTrouble(true)}>
                {t("trouble.skip")}
              </Button>
            </div>
          </Dialog>
        )}
      </section>

      {children}

      <section className="practice-column mt-12">
        <RecordList video={video} records={records} current={current} />
      </section>
    </>
  );
}

function RecordList({
  video,
  records,
  current,
}: {
  video: PracticeMaterial;
  records: SentenceRecords;
  current?: number;
}) {
  const t = useTranslations("shadowing");
  const format = useFormatter();
  return (
    <ol className="border-t border-line">
      {video.sentences.map((sentence, index) => {
        const record = records[index];
        return (
          <li
            key={sentence.i}
            aria-current={index === current ? "step" : undefined}
            className="grid grid-cols-[2rem_1fr_auto] items-baseline gap-4 border-b border-line py-4"
          >
            <span className="text-metadata text-ink-muted tabular-nums">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span lang="en" className={record?.done ? "" : "text-ink-muted"}>
              {sentence.en}
            </span>
            <span className="text-supporting whitespace-nowrap text-ink-muted tabular-nums">
              {record?.done && (
                <span aria-hidden="true" className="text-success">
                  ✓{" "}
                </span>
              )}
              {record?.skipped
                ? t("skippedDone")
                : record?.coverage !== null && record?.coverage !== undefined
                  ? format.number(record.coverage, {
                      style: "percent",
                      maximumFractionDigits: 0,
                    })
                  : record?.done
                    ? t("manualDone")
                    : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

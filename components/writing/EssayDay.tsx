"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { reviewEssay, type ReviewResult } from "@/app/writing/actions";
import { toLocalDate } from "@/lib/dates";
import {
  addToNotebook,
  errorItems,
  patternItems,
} from "@/lib/writing/notebook";
import {
  day30Of,
  newWritingProgress,
  resettleWritingWeek,
  settleWritingWeek,
  writingTimeId,
  type EssayDay as EssayDayRecord,
  type SelfScore,
} from "@/lib/writing/progress";
import {
  loadLocalDraft,
  loadLocalNotebook,
  saveLocalDraft,
  type Draft,
} from "@/lib/writing/store";
import { WRITING_TYPE_CONFIG, type WritingPrompt } from "@/lib/writing/types";
import { countWords } from "@/lib/writing/words";
import { Button } from "../Button";
import { Card } from "../Card";
import { usePracticeTimer } from "../usePracticeTimer";
import { FeedbackView, SelfScoreView } from "./FeedbackView";
import { ModelEssay } from "./ModelEssay";
import { RewritePanel } from "./RewritePanel";
import { SelfScoreForm } from "./SelfScoreForm";
import { PromptTask } from "./PromptTask";
import { LongResult } from "./LongResult";
import { WeekResult } from "./WeekResult";
import { WritingWorkspace } from "./WritingWorkspace";
import {
  useWritingData,
  useWritingProgress,
  useWritingSettings,
} from "./WritingProvider";
import { UpsellToAll } from "@/components/UpsellToAll";

/** Drafts are saved this often while typing (D187). */
export const AUTOSAVE_MS = 5_000;

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/**
 * Day 1 (write first) and Day 7 (write again, without looking back),
 * D187. The model and Day 1 stay hidden while writing. Drafts are saved
 * every 5 seconds and when leaving the page: in this browser, and to the
 * account when signed in. Signed in, the AI gives feedback; a guest (or
 * when the AI can't) scores the essay against the rubric themselves.
 */
export function EssayDay({
  prompt,
  day,
  signedIn,
  title,
}: {
  prompt: WritingPrompt;
  /** 30: the rewrite a month on (D203), kept apart from the week's days. */
  day: 1 | 7 | 30;
  signedIn: boolean;
  title: string;
}) {
  const t = useTranslations("writing");
  const tPlans = useTranslations("plans");
  const progress = useWritingProgress(prompt.id);
  const { cloud, saveProgress, saveNotebook } = useWritingData();
  const record = day === 30 ? day30Of(progress) : progress?.days[day];
  const done = Boolean(record?.done);

  const [text, setText] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReviewResult | null>(null);
  const [declined, setDeclined] = useState<EssayDayRecord | null>(null);
  const [selfScoring, setSelfScoring] = useState(false);
  const settings = useWritingSettings();
  const reviewFirst = (settings?.review ?? "ai") === "ai";
  // A learner's own prompt goes with the essay (D196).
  const customInput = prompt.custom
    ? { custom: { kind: prompt.custom, task: prompt.task } }
    : {};
  const lastSaved = useRef("");
  // Reviewed on this visit: Day 1's rewrite starts at once (D218).
  const [justReviewed, setJustReviewed] = useState(false);

  // Practice time counts toward the calendar like listening (D187).
  usePracticeTimer(writingTimeId(prompt.id), false, {
    active: !done && loaded,
  });

  // The draft: this browser's, or the account's when it's newer.
  useEffect(() => {
    if (done) return;
    let cancelled = false;
    const local = loadLocalDraft(window.localStorage, prompt.id, day);
    const apply = (draft: Draft | null) => {
      if (cancelled) return;
      if (draft) {
        setText(draft.text);
        lastSaved.current = draft.text;
      }
      setLoaded(true);
    };
    if (!cloud) {
      apply(local);
      return;
    }
    cloud
      .getDraft(prompt.id, day)
      .then((remote) =>
        apply(remote && (!local || remote.at > local.at) ? remote : local),
      )
      .catch(() => apply(local));
    return () => {
      cancelled = true;
    };
  }, [cloud, day, done, prompt.id]);

  // Saves the draft when it changed.
  const save = useRef(() => {});
  useEffect(() => {
    save.current = () => {
      if (!loaded || done || text === lastSaved.current) return;
      const draft = { text, at: new Date().toISOString() };
      saveLocalDraft(window.localStorage, prompt.id, day, draft);
      lastSaved.current = text;
      setSavedAt(draft.at);
      void cloud?.saveDraft(prompt.id, day, draft).catch(() => {});
    };
  });
  useEffect(() => {
    const timer = window.setInterval(() => save.current(), AUTOSAVE_MS);
    const leave = () => save.current();
    const hidden = () => {
      if (document.visibilityState === "hidden") save.current();
    };
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", hidden);
      save.current();
    };
  }, []);

  // The writing clock: runs while the page is in front (not enforced).
  useEffect(() => {
    if (done || !loaded) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [done, loaded]);

  if (progress === undefined) return null;
  const rubric = WRITING_TYPE_CONFIG[prompt.type].rubric;
  const words = countWords(text);

  /** The progress with this day's essay in its place. */
  const withDay = (
    base: NonNullable<typeof progress>,
    dayRecord: EssayDayRecord,
  ) =>
    day === 30
      ? {
          ...base,
          day30: { ...dayRecord, week: base.week },
          updatedAt: new Date().toISOString(),
        }
      : {
          ...base,
          days: { ...base.days, [day]: dayRecord },
          updatedAt: new Date().toISOString(),
        };

  const finish = (dayRecord: EssayDayRecord) => {
    const today = toLocalDate(new Date());
    const base = progress ?? newWritingProgress(prompt.id, today);
    const next =
      day === 30
        ? withDay(base, dayRecord)
        : settleWritingWeek(withDay(base, dayRecord));
    saveProgress(next);
    saveLocalDraft(window.localStorage, prompt.id, day, null);
    void cloud?.removeDraft(prompt.id, day).catch(() => {});
    // The notebook: the AI's quoted mistakes, and (Day 1) the patterns.
    toNotebook(dayRecord, day === 1);
  };

  const toNotebook = (dayRecord: EssayDayRecord, patterns: boolean) => {
    const items = [
      ...(dayRecord.feedback
        ? errorItems(prompt.id, [
            ...dayRecord.feedback.issues,
            ...dayRecord.feedback.more,
          ])
        : []),
      ...(patterns ? patternItems(prompt.id, prompt.patterns) : []),
    ];
    if (items.length) {
      saveNotebook(
        addToNotebook(
          loadLocalNotebook(window.localStorage),
          items,
          toLocalDate(new Date()),
        ),
      );
    }
  };

  /**
   * An AI review asked for after saving without one (D194): counted
   * against this week's reviews then. The day keeps its date and essay;
   * Day 7 judges the week again.
   */
  const reviewLater = async () => {
    if (!record || !progress) return;
    setError(null);
    setDeclined(null);
    setBusy(true);
    try {
      const result = await reviewEssay({
        promptId: prompt.id,
        ...customInput,
        day,
        essay: record.essay,
      });
      if (!result.ok) {
        setError(result);
        return;
      }
      if (result.feedback.declined) {
        setDeclined({ ...record, feedback: result.feedback });
        return;
      }
      const reviewed = { ...record, feedback: result.feedback };
      saveProgress(
        day === 30
          ? withDay(progress, reviewed)
          : resettleWritingWeek(withDay(progress, reviewed)),
      );
      toNotebook(reviewed, false);
      setJustReviewed(true);
    } catch {
      setError({ ok: false, reason: "failed" });
    } finally {
      setBusy(false);
    }
  };

  const submit = async (review: boolean) => {
    save.current();
    setError(null);
    setDeclined(null);
    // A guest, or "save only": the learner scores it (or skips that).
    if (!signedIn || !review) {
      setSelfScoring(true);
      return;
    }
    setBusy(true);
    try {
      const result = await reviewEssay({
        promptId: prompt.id,
        ...customInput,
        day,
        essay: text,
      });
      if (!result.ok) {
        setError(result);
        return;
      }
      const dayRecord: EssayDayRecord = {
        done: true,
        date: toLocalDate(new Date()),
        essay: text.trim(),
        seconds,
        feedback: result.feedback,
      };
      if (result.feedback.declined) {
        // Not a real attempt: no score, the essay stays to keep writing.
        setDeclined(dayRecord);
        return;
      }
      finish(dayRecord);
      setJustReviewed(true);
    } catch {
      setError({ ok: false, reason: "failed" });
    } finally {
      setBusy(false);
    }
  };

  const selfScored = (self: SelfScore | null) => {
    finish({
      done: true,
      date: toLocalDate(new Date()),
      essay: text.trim(),
      seconds,
      ...(self ? { self } : {}),
    });
    setSelfScoring(false);
  };

  const errorText = (result: ReviewResult) => {
    if (result.ok) return "";
    if (result.reason === "plan" && result.block) {
      return tPlans(`limits.${result.block.limit}`, {
        max: result.block.max ?? 0,
      });
    }
    return t(`essay.errors.${result.reason}`);
  };

  if (done && record) {
    const essay = record.essay;
    return (
      <div className="flex flex-col gap-10">
        <details className="rounded-base border border-line bg-surface">
          <summary className="tap flex min-h-11 cursor-pointer items-center px-3 py-2 text-supporting">
            {t("workspace.taskAgain")}
          </summary>
          <div className="border-t border-line p-3">
            <PromptTask prompt={prompt} />
          </div>
        </details>
        {record.feedback ? (
          <FeedbackView essay={essay} feedback={record.feedback} />
        ) : (
          <>
            {record.self ? (
              <SelfScoreView rubric={rubric} self={record.self} />
            ) : (
              <p className="text-ink-muted">{t("essay.savedOnly")}</p>
            )}
            <div
              lang="en"
              className="max-w-reading rounded-base border border-line bg-surface p-4 whitespace-pre-wrap"
            >
              {essay}
            </div>
            {signedIn && (
              <Card className="flex flex-col gap-3">
                <p>{t("essay.reviewLater")}</p>
                <div>
                  <Button
                    variant="secondary"
                    onClick={reviewLater}
                    disabled={busy}
                    aria-describedby={error ? "review-error" : undefined}
                  >
                    {busy ? t("essay.submitting") : t("essay.reviewNow")}
                  </Button>
                </div>
                {error && !error.ok && (
                  <p id="review-error" role="alert" className="text-error">
                    {errorText(error)}
                  </p>
                )}
                {error && !error.ok && error.reason === "plan" && (
                  <UpsellToAll need="writing" feature="essay-review" />
                )}
                {declined?.feedback && (
                  <FeedbackView
                    essay={declined.essay}
                    feedback={declined.feedback}
                  />
                )}
              </Card>
            )}
          </>
        )}
        {day === 7 && progress && (
          <WeekResult prompt={prompt} progress={progress} title={title} />
        )}
        {day === 30 && progress && <LongResult progress={progress} />}
        {day === 1 && progress && (
          <RewritePanel
            prompt={prompt}
            progress={progress}
            signedIn={signedIn}
            autoStart={justReviewed}
          />
        )}
        {/* The model essay only when asked for (D218). */}
        <ModelEssay prompt={prompt} folded />
        {day === 1 && (
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <p>{t("essay.nextDays")}</p>
            <Link
              href={`/writing/${prompt.id}`}
              className="tap inline-flex min-h-8 items-center underline pointer-coarse:min-h-11"
            >
              {t("essay.toOverview")}
            </Link>
          </Card>
        )}
      </div>
    );
  }

  const aiUnavailable =
    error &&
    !error.ok &&
    ["unavailable", "failed", "limit", "plan", "paused", "suspended"].includes(
      error.reason,
    );

  const notes = (
    <>
      <p className="text-supporting text-ink-muted">
        {day === 1
          ? t("essay.noPeek")
          : day === 30
            ? t("essay.day30")
            : t("essay.noLookBack")}
      </p>
      {!signedIn && (
        <p className="text-supporting">
          {t("essay.guest")}{" "}
          <Link
            href={`/login?next=/writing/${prompt.id}/day/${day}`}
            className="underline"
          >
            {t("essay.signIn")}
          </Link>
        </p>
      )}
    </>
  );

  if (selfScoring) {
    return (
      <div className="flex flex-col gap-4">
        {notes}
        <SelfScoreForm
          rubric={rubric}
          onDone={selfScored}
          onCancel={() => setSelfScoring(false)}
          onSkip={() => selfScored(null)}
        />
      </div>
    );
  }

  return (
    <WritingWorkspace
      summary={prompt.task}
      summaryLang="en"
      label={t("essay.label")}
      task={
        <div className="flex flex-col gap-4">
          {notes}
          <PromptTask prompt={prompt} />
        </div>
      }
    >
      <label
        htmlFor="essay"
        className="sr-only shrink-0 font-medium wide:not-sr-only"
      >
        {t("essay.label")}
      </label>
      <textarea
        id="essay"
        lang="en"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={!loaded || busy}
        spellCheck={false}
        autoCapitalize="sentences"
        placeholder={t("essay.placeholder")}
        className="min-h-20 w-full flex-1 resize-none rounded-base border border-line bg-surface p-3 leading-relaxed focus:border-ink"
      />
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line pt-3 pb-1">
        <p className="text-supporting tabular-nums" aria-live="polite">
          <span
            className={
              words < prompt.words.min || words > prompt.words.max
                ? "text-ink-muted"
                : "text-success"
            }
          >
            {t("essay.words", { count: words })}
          </span>{" "}
          <span className="text-ink-muted">
            {t("essay.target", prompt.words)} ·{" "}
            {t("essay.timer", {
              time: formatTime(seconds),
              minutes: prompt.minutes,
            })}
            {savedAt && ` · ${t("essay.saved")}`}
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            onClick={() => submit(signedIn ? reviewFirst : false)}
            disabled={busy || words < 1}
            aria-describedby={error ? "essay-error" : undefined}
          >
            {busy
              ? t("essay.submitting")
              : !signedIn
                ? t("essay.submitSelf")
                : reviewFirst
                  ? t("essay.submit")
                  : t("essay.saveOnly")}
          </Button>
          {signedIn && (
            <Button
              variant="secondary"
              onClick={() => submit(!reviewFirst)}
              disabled={busy || words < 1}
            >
              {reviewFirst ? t("essay.saveOnly") : t("essay.submit")}
            </Button>
          )}
        </div>
      </div>
      {error && !error.ok && (
        <div
          id="essay-error"
          role="alert"
          className="flex shrink-0 flex-col gap-2"
        >
          <p className="text-error">{errorText(error)}</p>
          {error.reason === "plan" && (
            <UpsellToAll need="writing" feature="essay-review" />
          )}
          {aiUnavailable && (
            <div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelfScoring(true)}
              >
                {t("essay.selfInstead")}
              </Button>
            </div>
          )}
        </div>
      )}
      {declined?.feedback && (
        <div className="shrink-0">
          <FeedbackView essay={declined.essay} feedback={declined.feedback} />
        </div>
      )}
    </WritingWorkspace>
  );
}

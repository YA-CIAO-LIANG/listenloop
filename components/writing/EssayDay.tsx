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
  newWritingProgress,
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
import { SelfScoreForm } from "./SelfScoreForm";
import { WeekResult } from "./WeekResult";
import { useWritingData, useWritingProgress } from "./WritingProvider";

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
  day: 1 | 7;
  signedIn: boolean;
  title: string;
}) {
  const t = useTranslations("writing");
  const tPlans = useTranslations("plans");
  const progress = useWritingProgress(prompt.id);
  const { cloud, saveProgress, saveNotebook } = useWritingData();
  const record = progress?.days[day];
  const done = Boolean(record?.done);

  const [text, setText] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReviewResult | null>(null);
  const [declined, setDeclined] = useState<EssayDayRecord | null>(null);
  const [selfScoring, setSelfScoring] = useState(false);
  const lastSaved = useRef("");

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

  const finish = (dayRecord: EssayDayRecord) => {
    const today = toLocalDate(new Date());
    const base = progress ?? newWritingProgress(prompt.id, today);
    const next = settleWritingWeek({
      ...base,
      days: { ...base.days, [day]: dayRecord },
      updatedAt: new Date().toISOString(),
    });
    saveProgress(next);
    saveLocalDraft(window.localStorage, prompt.id, day, null);
    void cloud?.removeDraft(prompt.id, day).catch(() => {});
    // The notebook: the AI's quoted mistakes, and (Day 1) the patterns.
    const items = [
      ...(dayRecord.feedback
        ? errorItems(prompt.id, [
            ...dayRecord.feedback.issues,
            ...dayRecord.feedback.more,
          ])
        : []),
      ...(day === 1 ? patternItems(prompt.id, prompt.patterns) : []),
    ];
    if (items.length) {
      saveNotebook(
        addToNotebook(loadLocalNotebook(window.localStorage), items, today),
      );
    }
  };

  const submit = async () => {
    save.current();
    setError(null);
    setDeclined(null);
    if (!signedIn) {
      setSelfScoring(true);
      return;
    }
    setBusy(true);
    try {
      const result = await reviewEssay({
        promptId: prompt.id,
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
    } catch {
      setError({ ok: false, reason: "failed" });
    } finally {
      setBusy(false);
    }
  };

  const selfScored = (self: SelfScore) => {
    finish({
      done: true,
      date: toLocalDate(new Date()),
      essay: text.trim(),
      seconds,
      self,
    });
    setSelfScoring(false);
  };

  if (done && record) {
    const essay = record.essay;
    return (
      <div className="flex flex-col gap-10">
        {record.feedback ? (
          <FeedbackView essay={essay} feedback={record.feedback} />
        ) : record.self ? (
          <>
            <SelfScoreView rubric={rubric} self={record.self} />
            <div
              lang="en"
              className="max-w-reading rounded-base border border-line bg-surface p-4 whitespace-pre-wrap"
            >
              {essay}
            </div>
          </>
        ) : null}
        {day === 7 && progress && (
          <WeekResult prompt={prompt} progress={progress} title={title} />
        )}
        <ModelEssay prompt={prompt} />
        {day === 1 && (
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <p>{t("essay.nextDays")}</p>
            <Link href={`/writing/${prompt.id}`} className="underline">
              {t("essay.toOverview")}
            </Link>
          </Card>
        )}
      </div>
    );
  }

  const errorText = (result: ReviewResult) => {
    if (result.ok) return "";
    if (result.reason === "plan" && result.block) {
      return tPlans(`limits.${result.block.limit}`, {
        max: result.block.max ?? 0,
      });
    }
    return t(`essay.errors.${result.reason}`);
  };
  const aiUnavailable =
    error &&
    !error.ok &&
    ["unavailable", "failed", "limit", "plan", "paused", "suspended"].includes(
      error.reason,
    );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-supporting text-ink-muted">
        {day === 1 ? t("essay.noPeek") : t("essay.noLookBack")}
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
      {selfScoring ? (
        <SelfScoreForm
          rubric={rubric}
          onDone={selfScored}
          onCancel={() => setSelfScoring(false)}
        />
      ) : (
        <>
          <label className="flex flex-col gap-2">
            <span className="font-medium">{t("essay.label")}</span>
            <textarea
              lang="en"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={!loaded || busy}
              rows={14}
              spellCheck={false}
              autoCapitalize="sentences"
              placeholder={t("essay.placeholder")}
              className="min-h-64 w-full resize-y rounded-base border border-line bg-surface p-3 leading-relaxed focus:border-ink"
              // Keyboards on phones: keep the caret's line in view.
              onFocus={(e) =>
                window.setTimeout(
                  () => e.target.scrollIntoView({ block: "center" }),
                  300,
                )
              }
            />
          </label>
          {/* Phones: the count and the button stay above the keyboard. */}
          <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-ground/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm split:mx-0 split:rounded-base split:border">
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
            <Button
              variant="primary"
              onClick={submit}
              disabled={busy || words < 1}
              aria-describedby={error ? "essay-error" : undefined}
            >
              {busy
                ? t("essay.submitting")
                : signedIn
                  ? t("essay.submit")
                  : t("essay.submitSelf")}
            </Button>
          </div>
          {error && !error.ok && (
            <div id="essay-error" role="alert" className="flex flex-col gap-2">
              <p className="text-error">{errorText(error)}</p>
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
            <FeedbackView essay={declined.essay} feedback={declined.feedback} />
          )}
        </>
      )}
    </div>
  );
}

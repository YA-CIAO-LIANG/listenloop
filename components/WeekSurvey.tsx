"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import {
  submitWeekSurvey,
  type WeekSurveyResult,
} from "@/app/week-survey-actions";
import {
  SURVEY_COMMENT_MAX,
  SURVEY_SCORES,
  SURVEY_STORAGE_KEY,
  surveyKey,
} from "@/lib/survey";
import { Button } from "./Button";

function readDone(): string[] {
  try {
    const raw = window.localStorage.getItem(SURVEY_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function markDone(key: string) {
  try {
    const done = new Set(readDone());
    done.add(key);
    window.localStorage.setItem(
      SURVEY_STORAGE_KEY,
      JSON.stringify([...done].slice(-200)),
    );
  } catch {
    // Storage blocked: the survey may show again next time.
  }
}

const noSubscribe = () => () => {};

/**
 * The short survey under a week's result (D164): 0–10 how likely to
 * recommend, and one optional open question. Answered or skipped once per
 * material and week on this device; signed-in learners only.
 */
export function WeekSurvey({
  videoId,
  week,
}: {
  videoId: string;
  week: number;
}) {
  const t = useTranslations("week.survey");
  const key = surveyKey(videoId, week);
  const seen = useSyncExternalStore(
    noSubscribe,
    () => readDone().includes(key),
    () => true,
  );
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<WeekSurveyResult | null>(null);
  const [skipped, setSkipped] = useState(false);
  const ids = { comment: useId(), hint: useId() };

  if (result?.ok) {
    return (
      <p role="status" className="text-success">
        {t("thanks")}
      </p>
    );
  }
  if (
    seen ||
    skipped ||
    (result?.ok === false && result.reason === "signedOut")
  )
    return null;

  async function send() {
    if (score === null) return;
    setPending(true);
    const outcome = await submitWeekSurvey({ videoId, week, score, comment });
    setPending(false);
    setResult(outcome);
    if (outcome.ok) markDone(key);
  }

  return (
    <section
      aria-labelledby={`${ids.comment}-title`}
      className="space-y-5 rounded-base border border-line bg-surface p-5"
    >
      <h3 id={`${ids.comment}-title`} className="font-display text-h3">
        {t("title")}
      </h3>
      <fieldset className="space-y-3">
        <legend className="font-medium">{t("question")}</legend>
        <div className="flex flex-wrap gap-2">
          {SURVEY_SCORES.map((value) => (
            <label
              key={value}
              className={`pressable flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-base border px-2 tabular-nums has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent ${
                score === value
                  ? "border-accent bg-accent/14 font-medium text-accent-ink"
                  : "border-line bg-surface"
              }`}
            >
              <input
                type="radio"
                name={`survey-${key}`}
                value={value}
                checked={score === value}
                onChange={() => setScore(value)}
                className="sr-only"
              />
              {value}
            </label>
          ))}
        </div>
        <p
          aria-hidden="true"
          className="flex justify-between text-metadata text-ink-muted"
        >
          <span>{t("low")}</span>
          <span>{t("high")}</span>
        </p>
      </fieldset>
      <div className="space-y-2">
        <label htmlFor={ids.comment} className="block font-medium">
          {t("commentLabel")}
        </label>
        <p id={ids.hint} className="text-supporting text-ink-muted">
          {t("commentHint")}
        </p>
        <textarea
          id={ids.comment}
          rows={3}
          value={comment}
          maxLength={SURVEY_COMMENT_MAX}
          aria-describedby={ids.hint}
          disabled={pending}
          onChange={(event) => setComment(event.target.value)}
          className="block w-full rounded-base border border-line bg-surface px-4 py-3 focus-visible:border-accent"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="primary"
          onClick={send}
          disabled={pending || score === null}
        >
          {pending ? t("sending") : t("send")}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            markDone(key);
            setSkipped(true);
          }}
          disabled={pending}
        >
          {t("skip")}
        </Button>
      </div>
      <div aria-live="polite">
        {result && !result.ok && (
          <p role="alert" className="text-error">
            {t(`errors.${result.reason}`)}
          </p>
        )}
      </div>
    </section>
  );
}

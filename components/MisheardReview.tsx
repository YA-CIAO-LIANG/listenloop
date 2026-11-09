"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { loadReviewMaterials } from "@/app/review/actions";
import { updateActivity } from "@/lib/claim-rewards";
import { toLocalDate } from "@/lib/dates";
import {
  addMisses,
  blankOut,
  dueReviews,
  isLearned,
  isRightAnswer,
  missesFromProgress,
  recordReview,
  type ReviewState,
  type ReviewWord,
} from "@/lib/review";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";
import { Card } from "./Card";
import { useStores } from "./StoresProvider";
import { useSamplePlayer } from "./useSamplePlayer";

type Answer = { key: string; typed: string; correct: boolean };

/**
 * "My misheard words" (D108): today's short review, one word at a time —
 * the sentence it was misheard in with the word blanked out, its Chinese,
 * and its audio when the material has one — then the whole list with when
 * each comes back. The list fills itself from dictation answers already
 * in progress, so words misheard before it existed are in it too.
 */
export function MisheardReview({
  load = loadReviewMaterials,
}: {
  load?: typeof loadReviewMaterials;
}) {
  const t = useTranslations("review");
  const stores = useStores();
  const [state, setState] = useState<ReviewState | null>(null);
  // Today's words, fixed when the page opens so answering doesn't reshuffle.
  const [queue, setQueue] = useState<[string, ReviewWord][]>([]);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [right, setRight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const current = queue[index];
  const { playing, toggle } = useSamplePlayer(() => current?.[1].audio ?? null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const progresses = await stores.progress.list().catch(() => []);
      const ids = progresses
        .filter((p) => p.days[1]?.done || p.days[7]?.done)
        .map((p) => p.videoId);
      const materials = ids.length ? await load(ids).catch(() => ({})) : {};
      const now = new Date();
      const activity = await updateActivity(stores.rewards, (before) => {
        const start = before.review ?? {};
        let review = start;
        for (const { date, misses } of missesFromProgress(
          progresses,
          materials,
        )) {
          review = addMisses(review, misses, date, now, { onlyNew: true });
        }
        return review === start ? before : { ...before, review };
      }).catch(() => null);
      if (cancelled) return;
      const review = activity?.review ?? {};
      setState(review);
      setQueue(dueReviews(review, toLocalDate(now)));
    })();
    return () => {
      cancelled = true;
    };
  }, [stores, load]);

  useEffect(() => {
    if (answer) nextRef.current?.focus();
    else inputRef.current?.focus();
  }, [answer, index]);

  if (state === null) {
    return <p className="text-ink-muted">{t("loading")}</p>;
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!current || answer || typed.trim() === "") return;
    const [key, review] = current;
    const word = blankOut(review.en, key)?.word ?? key;
    const correct = isRightAnswer(typed, word);
    setAnswer({ key, typed, correct });
    if (correct) setRight((n) => n + 1);
    const now = new Date();
    void updateActivity(stores.rewards, (activity) => ({
      ...activity,
      review: recordReview(
        activity.review ?? {},
        key,
        correct,
        toLocalDate(now),
        now,
      ),
    }))
      .then((activity) => setState(activity.review ?? {}))
      .catch(() => {});
  }

  function next() {
    setAnswer(null);
    setTyped("");
    setIndex((i) => i + 1);
  }

  const words = Object.entries(state).sort(
    ([a, x], [b, y]) =>
      Number(isLearned(x)) - Number(isLearned(y)) ||
      x.due.localeCompare(y.due) ||
      a.localeCompare(b),
  );
  const blank = current ? blankOut(current[1].en, current[0]) : null;

  return (
    <div className="space-y-12">
      <section aria-labelledby="review-today" className="space-y-4">
        <h2 id="review-today" className="font-display text-h2">
          {t("todayTitle")}
        </h2>
        {queue.length === 0 ? (
          <p className="text-ink-muted">
            {words.length === 0 ? t("emptyList") : t("noneToday")}
          </p>
        ) : current ? (
          <Card className="max-w-reading space-y-4">
            <p className="text-supporting text-ink-muted">
              {t("count", { n: index + 1, total: queue.length })}
            </p>
            <p lang="en" className="text-h3">
              {blank ? (
                <>
                  {blank.before}
                  <span className="mark-key px-1">
                    {answer ? blank.word : "_____"}
                  </span>
                  {blank.after}
                </>
              ) : (
                current[1].en
              )}
            </p>
            <p lang="zh-Hant" className="text-supporting text-ink-muted">
              {current[1].zh}
            </p>
            {current[1].audio && (
              <Button
                variant="secondary"
                size="sm"
                aria-pressed={playing !== null}
                onClick={() => toggle(current[0])}
              >
                {playing ? t("stop") : t("listen")}
              </Button>
            )}
            <form onSubmit={submit} className="space-y-3">
              <label htmlFor="review-answer" className="block font-medium">
                {t("answerLabel")}
              </label>
              <input
                id="review-answer"
                ref={inputRef}
                lang="en"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                value={typed}
                readOnly={answer !== null}
                onChange={(event) => setTyped(event.target.value)}
                className="block w-full max-w-sm rounded-base border border-line bg-surface px-4 py-3 focus-visible:border-accent"
              />
              {!answer && (
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!typed.trim()}
                >
                  {t("check")}
                </Button>
              )}
            </form>
            {answer && (
              <div role="status" className="space-y-3">
                <p className={answer.correct ? "text-success" : "text-error"}>
                  <span aria-hidden="true">{answer.correct ? "✓ " : "✗ "}</span>
                  {answer.correct
                    ? t("right")
                    : t("wrong", { word: blank?.word ?? answer.key })}
                </p>
                <p className="text-supporting text-ink-muted">
                  {answer.correct ? t("rightNext") : t("wrongNext")}
                </p>
                <Button ref={nextRef} variant="primary" onClick={next}>
                  {index + 1 < queue.length ? t("next") : t("finish")}
                </Button>
              </div>
            )}
          </Card>
        ) : (
          <Card className="max-w-reading space-y-4">
            <p role="status">{t("done", { right, total: queue.length })}</p>
            <ButtonLink href="/" variant="secondary">
              {t("home")}
            </ButtonLink>
          </Card>
        )}
      </section>

      {words.length > 0 && (
        <section aria-labelledby="review-list" className="space-y-4">
          <h2 id="review-list" className="font-display text-h2">
            {t("listTitle", { count: words.length })}
          </h2>
          <p className="max-w-reading text-supporting text-ink-muted">
            {t("listIntro")}
          </p>
          <ul className="max-w-reading divide-y divide-line">
            {words.map(([key, review]) => (
              <li key={key} className="space-y-1 py-3">
                <p className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <span lang="en" className="font-medium">
                    {key}
                  </span>
                  <span className="text-supporting text-ink-muted">
                    {isLearned(review)
                      ? t("learned")
                      : t("due", { date: review.due })}
                  </span>
                </p>
                <p lang="en" className="text-supporting text-ink-muted">
                  {review.en}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

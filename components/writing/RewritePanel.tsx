"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Fragment, useEffect, useRef, useState } from "react";
import {
  rewriteEssay,
  type RewriteResult,
} from "@/app/writing/rewrite-actions";
import { wordDiff, type DisplayWord } from "@/lib/scoring/word-diff";
import {
  addVersion,
  chooseVersion,
  shownVersion,
  versionsLeft,
} from "@/lib/writing/rewrite/state";
import {
  REWRITE_LEVELS,
  type RewriteAdjust,
  type RewriteLevel,
  type RewriteVersion,
} from "@/lib/writing/rewrite/types";
import type { WritingProgress } from "@/lib/writing/progress";
import type { WritingPrompt } from "@/lib/writing/types";
import { Button } from "../Button";
import { Card } from "../Card";
import { UpsellToAll } from "../UpsellToAll";
import { useWritingData, useWritingSettings } from "./WritingProvider";

/**
 * Day 1's essay, corrected (D218): the AI's version of the learner's own
 * essay that Days 2–6 practice. Three levels (only fix errors, natural,
 * advanced), each sentence shown before and after with what changed and
 * why (in the writing color); "too hard" and "a bit harder" make another
 * version from the one shown; the learner compares the versions and
 * chooses one to practice. Every version is one AI call, counted in the
 * AI allowance, and kept with Day 1, so switching back costs nothing.
 */
export function RewritePanel({
  prompt,
  progress,
  signedIn,
  autoStart = false,
}: {
  prompt: WritingPrompt;
  progress: WritingProgress;
  signedIn: boolean;
  /** Ask for the default level at once (Day 2's "rewrite my essay"). */
  autoStart?: boolean;
}) {
  const t = useTranslations("writing.rewrite");
  const tPlans = useTranslations("plans");
  const settings = useWritingSettings();
  const { saveProgress } = useWritingData();
  const day1 = progress.days[1];
  const essay = day1?.essay ?? "";
  const rewrite = day1?.rewrite?.essay === essay ? day1.rewrite : undefined;
  const [shownId, setShownId] = useState<string | null>(null);
  const [busy, setBusy] = useState<RewriteLevel | RewriteAdjust | null>(null);
  const [error, setError] = useState<RewriteResult | null>(null);
  const started = useRef(false);
  const shown = shownVersion(rewrite, shownId);
  const defaultLevel = settings?.rewriteLevel ?? "natural";

  const save = (next: WritingProgress["days"][1]) =>
    saveProgress({
      ...progress,
      days: { ...progress.days, 1: next },
      updatedAt: new Date().toISOString(),
    });

  const ask = async (level: RewriteLevel, adjust?: RewriteAdjust) => {
    if (!day1 || busy) return;
    setError(null);
    setBusy(adjust ?? level);
    try {
      const result = await rewriteEssay({
        promptId: prompt.id,
        ...(prompt.custom
          ? { custom: { kind: prompt.custom, task: prompt.task } }
          : {}),
        essay,
        level,
        ...(adjust && shown
          ? {
              adjust,
              current: shown.sentences.map((s) => ({ i: s.i, en: s.revised })),
            }
          : {}),
      });
      if (!result.ok) {
        setError(result);
        return;
      }
      const version: RewriteVersion = {
        ...result.version,
        ...(adjust && shown ? { from: shown.id } : {}),
      };
      save({ ...day1, rewrite: addVersion(rewrite, essay, version) });
      setShownId(version.id);
    } catch {
      setError({ ok: false, reason: "failed" });
    } finally {
      setBusy(null);
    }
  };

  // Day 2's "rewrite my essay", or right after Day 1's review: once.
  const shouldStart =
    autoStart && signedIn && !rewrite && Boolean(day1?.done && essay);
  useEffect(() => {
    if (!shouldStart || started.current) return;
    started.current = true;
    void ask(defaultLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldStart]);

  if (!day1?.done || !essay) return null;

  const levelVersion = (level: RewriteLevel) =>
    rewrite?.versions.find((v) => v.level === level && !v.adjust);
  const left = versionsLeft(rewrite);
  const errorText = (result: RewriteResult) => {
    if (result.ok) return "";
    if (result.reason === "plan" && result.block) {
      return tPlans(`limits.${result.block.limit}`, {
        max: result.block.max ?? 0,
      });
    }
    return t(`errors.${result.reason}`);
  };

  return (
    <section
      aria-labelledby="rewrite-heading"
      data-testid="rewrite-panel"
      className="flex flex-col gap-4"
    >
      <h2 id="rewrite-heading" className="font-display text-h3">
        {t("heading")}
      </h2>
      <p className="max-w-reading text-supporting text-ink-muted">
        {t("intro")}
      </p>

      {!signedIn ? (
        <p className="text-supporting">
          {t("signIn")}{" "}
          <Link
            href={`/login?next=/writing/${prompt.id}/day/2`}
            className="underline"
          >
            {t("signInLink")}
          </Link>
        </p>
      ) : (
        <>
          <div
            role="group"
            aria-label={t("levelLabel")}
            className="flex flex-wrap gap-2"
          >
            {REWRITE_LEVELS.map((level) => {
              const version = levelVersion(level);
              const current = shown?.level === level && !shown.adjust;
              return (
                <Button
                  key={level}
                  variant={current ? "primary" : "secondary"}
                  size="sm"
                  aria-pressed={current}
                  disabled={busy !== null || (!version && left === 0)}
                  onClick={() =>
                    version ? setShownId(version.id) : void ask(level)
                  }
                >
                  {t(`levels.${level}`)}
                  {!version && (
                    <span className="sr-only"> {t("costsOne")}</span>
                  )}
                </Button>
              );
            })}
          </div>
          <p className="text-metadata text-ink-muted">
            {t(`levelHelp.${shown?.level ?? defaultLevel}`)}
          </p>

          {busy && (
            <p role="status" className="text-supporting">
              {t("working")}
            </p>
          )}
          {error && !error.ok && (
            <>
              <p role="alert" className="text-error">
                {errorText(error)}
              </p>
              {error.reason === "plan" && (
                <UpsellToAll need="writing" feature="essay-review" />
              )}
            </>
          )}
          {!rewrite && !busy && (
            <div>
              <Button variant="primary" onClick={() => void ask(defaultLevel)}>
                {t("start", { level: t(`levels.${defaultLevel}`) })}
              </Button>
              <p className="mt-2 text-metadata text-ink-muted">
                {t("costNote")}
              </p>
            </div>
          )}
        </>
      )}

      {rewrite && rewrite.versions.length > 1 && (
        <div className="flex flex-col gap-2">
          <p id="rewrite-versions" className="text-metadata text-ink-muted">
            {t("versions")}
          </p>
          <ul
            aria-labelledby="rewrite-versions"
            className="flex flex-wrap gap-2"
          >
            {rewrite.versions.map((v) => (
              <li key={v.id}>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-pressed={shown?.id === v.id}
                  onClick={() => setShownId(v.id)}
                  className={shown?.id === v.id ? "bg-accent/14" : ""}
                >
                  {versionName(t, v)}
                  {rewrite.chosen === v.id && ` · ${t("chosenTag")}`}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {shown && (
        <Card className="flex flex-col gap-4" data-testid="rewrite-version">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-medium">{versionName(t, shown)}</h3>
            <p className="text-metadata text-ink-muted">
              {t("changedCount", {
                changed: shown.sentences.filter((s) => s.changed).length,
                total: shown.sentences.length,
              })}{" "}
              · {t("grade", { grade: shown.grade })}
            </p>
          </div>
          <ol className="flex flex-col gap-4">
            {shown.sentences.map((s) => (
              <SentenceChange key={s.i} sentence={s} />
            ))}
          </ol>
          {signedIn && (
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <Button
                variant="secondary"
                size="sm"
                disabled={busy !== null || left === 0}
                onClick={() => void ask(shown.level, "easier")}
              >
                {busy === "easier" ? t("working") : t("easier")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy !== null || left === 0}
                onClick={() => void ask(shown.level, "harder")}
              >
                {busy === "harder" ? t("working") : t("harder")}
              </Button>
              <p className="w-full text-metadata text-ink-muted">
                {left === 0 ? t("noMore") : t("adjustNote", { left })}
              </p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {rewrite?.chosen === shown.id ? (
              <p role="status" className="font-medium text-accent-ink">
                {t("chosen")}
              </p>
            ) : (
              <Button
                variant="primary"
                onClick={() =>
                  day1 &&
                  save({ ...day1, rewrite: chooseVersion(rewrite, shown.id) })
                }
              >
                {t("choose")}
              </Button>
            )}
            <p className="text-metadata text-ink-muted">{t("chooseNote")}</p>
          </div>
        </Card>
      )}
    </section>
  );
}

function versionName(
  t: ReturnType<typeof useTranslations<"writing.rewrite">>,
  v: RewriteVersion,
) {
  const level = t(`levels.${v.level}`);
  return v.adjust ? t(`adjusted.${v.adjust}`, { level }) : level;
}

/**
 * One sentence before and after (D218): the learner's words with what
 * changed struck through, the new version with what's new underlined in
 * the writing color, and why. Never color alone (strike and underline),
 * and screen readers hear "before", "after", "why".
 */
function SentenceChange({
  sentence,
}: {
  sentence: RewriteVersion["sentences"][number];
}) {
  const t = useTranslations("writing.rewrite");
  if (!sentence.changed) {
    return (
      <li className="flex flex-col gap-1">
        <p lang="en">{sentence.revised}</p>
        <p className="text-metadata text-ink-muted">{t("unchanged")}</p>
      </li>
    );
  }
  const diff = wordDiff(sentence.revised, sentence.original);
  return (
    <li className="flex flex-col gap-1" data-testid="rewrite-change">
      <dl className="grid gap-x-3 gap-y-1 split:grid-cols-[auto_1fr]">
        <dt className="text-metadata text-ink-muted split:pt-0.5">
          {t("before")}
        </dt>
        <dd lang="en" className="text-ink-muted">
          <Words
            words={diff.answer}
            render={(w) => <del className="decoration-1">{w.text}</del>}
          />
        </dd>
        <dt className="text-metadata text-ink-muted split:pt-0.5">
          {t("after")}
        </dt>
        <dd lang="en">
          <Words
            words={diff.reference}
            render={(w) => (
              <ins className="bg-accent/14 font-medium text-accent-ink underline decoration-accent decoration-2 underline-offset-4">
                {w.text}
              </ins>
            )}
          />
        </dd>
        {sentence.why && (
          <>
            <dt className="text-metadata text-ink-muted split:pt-0.5">
              {t("why")}
            </dt>
            <dd className="text-supporting">{sentence.why}</dd>
          </>
        )}
      </dl>
    </li>
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

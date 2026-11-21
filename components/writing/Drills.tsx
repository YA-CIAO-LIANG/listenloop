"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  checkCombine,
  checkFix,
  checkParaphrase,
  checkPattern,
  REBUILD_PASS,
  REBUILD_SHOW_SECONDS,
  rebuildAccuracy,
  shuffledOrder,
  type DrillCheck,
} from "@/lib/writing/drills";
import type { FeedbackIssue } from "@/lib/writing/feedback";
import type {
  CombineDrill as CombineItem,
  ParaphraseDrill as ParaphraseItem,
  WritingPattern,
} from "@/lib/writing/types";
import { countWords } from "@/lib/writing/words";
import { Button } from "../Button";
import { Card } from "../Card";

/** A drill reports once: right on the first try or not. */
export type DrillDone = (correct: boolean) => void;

/**
 * One "write, check at once, see the model answer" step (D187): the
 * learner writes, the rule check answers immediately, then the model
 * answer shows (retrieval first, then feedback). A miss can be tried
 * again, but the first check is what counts.
 */
function WriteAndCheck({
  id,
  label,
  check,
  answer,
  onDone,
  rows = 2,
}: {
  id: string;
  label: string;
  check: (text: string) => DrillCheck;
  answer: ReactNode;
  onDone: DrillDone;
  rows?: number;
}) {
  const t = useTranslations("writing.drills");
  const [text, setText] = useState("");
  const [first, setFirst] = useState<boolean | null>(null);
  const [result, setResult] = useState<DrillCheck | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <textarea
        id={id}
        lang="en"
        rows={rows}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full rounded-base border border-line bg-surface p-3 focus:border-ink"
        spellCheck={false}
      />
      <div className="flex flex-wrap gap-3">
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            const r = check(text);
            setResult(r);
            if (first === null) setFirst(r.ok);
          }}
          disabled={!text.trim()}
        >
          {t("check")}
        </Button>
        {result && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onDone(first ?? false)}
          >
            {t("next")}
          </Button>
        )}
      </div>
      {result && (
        <div role="status" className="flex flex-col gap-2">
          <p className={result.ok ? "text-success" : "text-error"}>
            {result.ok ? t("ok") : t(`problems.${result.reason ?? "differs"}`)}
          </p>
          <div className="text-supporting">
            <span className="text-ink-muted">{t("answer")}</span> {answer}
          </div>
        </div>
      )}
    </div>
  );
}

const En = ({ children }: { children: ReactNode }) => (
  <span lang="en" className="font-medium">
    {children}
  </span>
);

/** Fix your own sentences from Day 1: try first, then the correction. */
export function FixDrill({
  items,
  onDone,
}: {
  items: FeedbackIssue[];
  onDone: DrillDone;
}) {
  const t = useTranslations("writing.drills");
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const item = items[index];
  if (!item) return null;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-supporting text-ink-muted">
        {t("progress", { n: index + 1, total: items.length })}
      </p>
      <Card>
        <p lang="en">{item.quote}</p>
      </Card>
      <WriteAndCheck
        key={index}
        id={`fix-${index}`}
        label={t("fix.label")}
        check={(text) => checkFix(text, item)}
        answer={
          <>
            <En>{item.suggestion}</En> — {item.why}
          </>
        }
        onDone={(ok) => {
          const right = score + (ok ? 1 : 0);
          if (index + 1 < items.length) {
            setScore(right);
            setIndex(index + 1);
          } else onDone(right * 2 >= items.length);
        }}
      />
    </div>
  );
}

export function PatternDrill({
  pattern,
  onDone,
}: {
  pattern: WritingPattern;
  onDone: DrillDone;
}) {
  const t = useTranslations("writing.drills");
  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col gap-1">
        <p>
          <En>{pattern.pattern}</En>
        </p>
        <p className="text-supporting text-ink-muted">{pattern.zh}</p>
      </Card>
      <WriteAndCheck
        id="pattern"
        label={t("pattern.label")}
        check={(text) => checkPattern(text, pattern)}
        answer={<En>{pattern.example}</En>}
        onDone={onDone}
      />
    </div>
  );
}

export function CombineDrill({
  item,
  onDone,
}: {
  item: CombineItem;
  onDone: DrillDone;
}) {
  const t = useTranslations("writing.drills");
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <ul lang="en" className="list-disc pl-5">
          {item.parts.map((part) => (
            <li key={part}>{part}</li>
          ))}
        </ul>
      </Card>
      <WriteAndCheck
        id="combine"
        label={t("combine.label")}
        check={(text) => checkCombine(text, item)}
        answer={<En>{item.answer}</En>}
        onDone={onDone}
      />
    </div>
  );
}

export function ParaphraseDrill({
  item,
  onDone,
}: {
  item: ParaphraseItem;
  onDone: DrillDone;
}) {
  const t = useTranslations("writing.drills");
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <p lang="en">{item.sentence}</p>
      </Card>
      <WriteAndCheck
        id="paraphrase"
        label={t("paraphrase.label")}
        check={(text) => checkParaphrase(text, item)}
        answer={
          <span className="flex flex-col">
            {item.answers.map((a) => (
              <En key={a}>{a}</En>
            ))}
          </span>
        }
        onDone={onDone}
      />
    </div>
  );
}

/** Put a model paragraph's sentences back in order (cohesion). */
export function ReorderDrill({
  sentences,
  seed,
  onDone,
}: {
  sentences: string[];
  seed: string;
  onDone: DrillDone;
}) {
  const t = useTranslations("writing.drills");
  const start = useMemo(
    () => shuffledOrder(sentences.length, seed),
    [sentences.length, seed],
  );
  const [order, setOrder] = useState(start);
  const [checked, setChecked] = useState<boolean | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    [next[from], next[to]] = [next[to], next[from]];
    setOrder(next);
  };
  const right = order.every((value, index) => value === index);
  return (
    <div className="flex flex-col gap-3">
      <p className="font-medium">{t("reorder.label")}</p>
      <ol className="flex flex-col gap-2">
        {order.map((sentence, index) => (
          <li
            key={sentence}
            className="flex items-start gap-2 rounded-base border border-line bg-surface p-2"
          >
            <span className="w-6 shrink-0 text-right tabular-nums">
              {index + 1}.
            </span>
            <span lang="en" className="min-w-0 flex-1">
              {sentences[sentence]}
            </span>
            <span className="flex shrink-0 gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => move(index, index - 1)}
                disabled={index === 0 || checked !== null}
                aria-label={t("reorder.up", { n: index + 1 })}
              >
                ↑
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => move(index, index + 1)}
                disabled={index === order.length - 1 || checked !== null}
                aria-label={t("reorder.down", { n: index + 1 })}
              >
                ↓
              </Button>
            </span>
          </li>
        ))}
      </ol>
      {checked === null ? (
        <div>
          <Button variant="primary" size="sm" onClick={() => setChecked(right)}>
            {t("check")}
          </Button>
        </div>
      ) : (
        <div role="status" className="flex flex-col gap-2">
          <p className={checked ? "text-success" : "text-error"}>
            {checked ? t("ok") : t("reorder.wrong")}
          </p>
          {!checked && (
            <ol lang="en" className="list-decimal pl-6 text-supporting">
              {sentences.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          )}
          <div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onDone(checked)}
            >
              {t("next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Read a paragraph for 30 seconds, then write it from memory. */
export function RebuildDrill({
  paragraph,
  onDone,
}: {
  paragraph: string;
  onDone: DrillDone;
}) {
  const t = useTranslations("writing.drills");
  const [phase, setPhase] = useState<"ready" | "reading" | "writing" | "done">(
    "ready",
  );
  const [left, setLeft] = useState(REBUILD_SHOW_SECONDS);
  const [text, setText] = useState("");
  useEffect(() => {
    if (phase !== "reading") return;
    const timer = window.setTimeout(
      () => (left <= 1 ? setPhase("writing") : setLeft(left - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [phase, left]);
  const accuracy = phase === "done" ? rebuildAccuracy(paragraph, text) : 0;
  return (
    <div className="flex flex-col gap-3">
      {phase === "ready" && (
        <>
          <p>{t("rebuild.intro", { seconds: REBUILD_SHOW_SECONDS })}</p>
          <div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setPhase("reading")}
            >
              {t("rebuild.show")}
            </Button>
          </div>
        </>
      )}
      {phase === "reading" && (
        <>
          <p
            className="text-supporting text-ink-muted tabular-nums"
            aria-live="polite"
          >
            {t("rebuild.left", { seconds: left })}
          </p>
          <Card>
            <p lang="en">{paragraph}</p>
          </Card>
          <div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPhase("writing")}
            >
              {t("rebuild.ready")}
            </Button>
          </div>
        </>
      )}
      {(phase === "writing" || phase === "done") && (
        <>
          <label htmlFor="rebuild" className="font-medium">
            {t("rebuild.label")}
          </label>
          <textarea
            id="rebuild"
            lang="en"
            rows={5}
            value={text}
            disabled={phase === "done"}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-base border border-line bg-surface p-3"
            spellCheck={false}
          />
          {phase === "writing" ? (
            <div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setPhase("done")}
                disabled={!text.trim()}
              >
                {t("check")}
              </Button>
            </div>
          ) : (
            <div role="status" className="flex flex-col gap-2">
              <p
                className={
                  accuracy >= REBUILD_PASS ? "text-success" : "text-error"
                }
              >
                {t("rebuild.result", { percent: Math.round(accuracy * 100) })}
              </p>
              <Card>
                <p lang="en" className="text-supporting">
                  {paragraph}
                </p>
              </Card>
              <div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onDone(accuracy >= REBUILD_PASS)}
                >
                  {t("next")}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Listen in ListenLoop, then write a short summary or response. */
export function ListenDrill({
  videoId,
  onDone,
}: {
  videoId: string;
  onDone: DrillDone;
}) {
  const t = useTranslations("writing.drills");
  const [text, setText] = useState("");
  const [checked, setChecked] = useState(false);
  const words = countWords(text);
  const enough = words >= 20;
  return (
    <div className="flex flex-col gap-3">
      <p>{t("listen.intro")}</p>
      <div>
        <Link
          href={`/videos/${videoId}/listen`}
          target="_blank"
          className="underline"
        >
          {t("listen.open")}
        </Link>
      </div>
      <label htmlFor="listen" className="font-medium">
        {t("listen.label")}
      </label>
      <textarea
        id="listen"
        lang="en"
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full rounded-base border border-line bg-surface p-3"
        spellCheck={false}
      />
      <p className="text-supporting text-ink-muted tabular-nums">
        {t("listen.words", { count: words })}
      </p>
      {!checked ? (
        <div>
          <Button
            variant="primary"
            size="sm"
            disabled={!text.trim()}
            onClick={() => setChecked(true)}
          >
            {t("check")}
          </Button>
        </div>
      ) : (
        <div role="status" className="flex flex-col gap-2">
          <p className={enough ? "text-success" : "text-error"}>
            {enough ? t("listen.ok") : t("listen.short")}
          </p>
          <p className="text-supporting text-ink-muted">{t("listen.tips")}</p>
          <div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onDone(enough)}
            >
              {t("next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { LEVELS } from "@/lib/categories";
import {
  LEVEL_PASS,
  LEVEL_TEST_KEY,
  parseSavedLevelTest,
  recommendMaterial,
  scoreLevelTest,
  type LevelTestResult,
  type LevelTestSentence,
  type LevelTestSource,
} from "@/lib/level-test";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";
import { Card } from "./Card";
import { useSamplePlayer } from "./useSamplePlayer";

const noSubscribe = () => () => {};

function readSavedLevel(): string | null {
  try {
    return localStorage.getItem(LEVEL_TEST_KEY);
  } catch {
    return null;
  }
}

/**
 * The level test (D109): each sentence plays (and can be replayed), the
 * learner types it, and after the last one the result shows each level's
 * accuracy, the recommended level, and a first material. No answers are
 * shown along the way, like a placement test. The result stays on this
 * device.
 */
export function LevelTest({
  sentences,
  sources,
}: {
  sentences: readonly LevelTestSentence[];
  sources: readonly LevelTestSource[];
}) {
  const t = useTranslations("levelTest");
  const tLevels = useTranslations("video.levels");
  const [step, setStep] = useState<number | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<LevelTestResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { playing, toggle } = useSamplePlayer((id) =>
    sentences[Number(id)] ? sentences[Number(id)].audioUrl : null,
  );

  // The last result on this device, read after hydration (null on the
  // server); it changes only when this page saves a new one.
  const saved = useSyncExternalStore(noSubscribe, readSavedLevel, () => null);
  const previous = result ? null : parseSavedLevelTest(saved)?.level;

  if (sentences.length === 0) {
    return <p className="text-ink-muted">{t("unavailable")}</p>;
  }

  function play(index: number) {
    toggle(String(index));
  }

  function start() {
    setAnswers([]);
    setTyped("");
    setResult(null);
    setStep(0);
    play(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (step === null) return;
    const next = [...answers, typed];
    setAnswers(next);
    setTyped("");
    if (step + 1 < sentences.length) {
      setStep(step + 1);
      play(step + 1);
      inputRef.current?.focus();
      return;
    }
    const scored = scoreLevelTest(sentences, next);
    setResult(scored);
    setStep(null);
    try {
      localStorage.setItem(
        LEVEL_TEST_KEY,
        JSON.stringify({ ...scored, date: new Date().toISOString() }),
      );
    } catch {
      // Storage blocked: the result still shows.
    }
  }

  if (result) {
    const material = recommendMaterial(sources, result.level, sentences);
    return (
      <Card className="max-w-reading space-y-6">
        <div role="status" className="space-y-2">
          <p className="text-supporting text-ink-muted">{t("resultLabel")}</p>
          <p className="font-display text-h2">
            {t("resultLevel", { level: tLevels(result.level) })}
          </p>
        </div>
        <ul className="space-y-1 text-supporting">
          {LEVELS.map((level) =>
            result.scores[level] === undefined ? null : (
              <li key={level} className="flex justify-between gap-4">
                <span>{tLevels(level)}</span>
                <span className="tabular-nums">
                  {Math.round((result.scores[level] ?? 0) * 100)}%
                  {(result.scores[level] ?? 0) >= LEVEL_PASS && (
                    <span className="text-success"> ✓</span>
                  )}
                </span>
              </li>
            ),
          )}
        </ul>
        <p className="text-supporting text-ink-muted">
          {t("how", { pass: Math.round(LEVEL_PASS * 100) })}
        </p>
        <div className="flex flex-wrap gap-3">
          {material && (
            <ButtonLink href={`/videos/${material}`} variant="primary" arrow>
              {t("startMaterial")}
            </ButtonLink>
          )}
          <ButtonLink
            href={`/?level=${result.level}#library`}
            variant="secondary"
          >
            {t("browseLevel", { level: tLevels(result.level) })}
          </ButtonLink>
          <Button variant="ghost" onClick={start}>
            {t("again")}
          </Button>
        </div>
      </Card>
    );
  }

  if (step === null) {
    return (
      <Card className="max-w-reading space-y-4">
        <ul className="list-disc space-y-1 pl-5 text-supporting">
          <li>{t("ruleCount", { count: sentences.length })}</li>
          <li>{t("ruleReplay")}</li>
          <li>{t("ruleSound")}</li>
        </ul>
        {previous && (
          <p className="text-supporting text-ink-muted">
            {t("previous", { level: tLevels(previous) })}
          </p>
        )}
        <Button variant="primary" onClick={start} arrow>
          {t("start")}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="max-w-reading space-y-4">
      <p className="text-supporting text-ink-muted">
        {t("progress", { n: step + 1, total: sentences.length })}
      </p>
      <Button
        variant="secondary"
        aria-pressed={playing !== null}
        onClick={() => play(step)}
      >
        {playing ? t("stop") : t("replay")}
      </Button>
      <form onSubmit={submit} className="space-y-3">
        <label htmlFor="level-answer" className="block font-medium">
          {t("answerLabel")}
        </label>
        <input
          id="level-answer"
          ref={inputRef}
          lang="en"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          className="block w-full rounded-base border border-line bg-surface px-4 py-3 focus-visible:border-accent"
        />
        <Button type="submit" variant="primary">
          {step + 1 < sentences.length ? t("next") : t("finish")}
        </Button>
      </form>
    </Card>
  );
}

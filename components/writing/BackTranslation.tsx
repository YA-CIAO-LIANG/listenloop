"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type KeyboardEvent } from "react";
import { writingSentenceAudioUrl } from "@/app/writing/audio-actions";
import { wordDiff } from "@/lib/scoring/word-diff";
import {
  checkBack,
  itemMode,
  type BackItem,
  type BackResult,
} from "@/lib/writing/back-translation";
import type { DictationMode } from "@/lib/writing/settings";
import { Button } from "../Button";
import { useWordSound } from "../useWordSound";
import { WordDiffView } from "../WordDiffView";
import { WritingWorkspace } from "./WritingWorkspace";

/** The pause between plays when looping a sentence. */
const LOOP_GAP_MS = 1_500;

/**
 * The daily back-translation drill (聽寫回譯, D195): each sentence
 * heard (or read in Chinese), written back, and checked at once by
 * ListenLoop's dictation rules (numbers in any form, mistakes
 * highlighted). Listening modes play the first sentence on arrival;
 * replay and loop sit above the answer box. The first answer to each
 * sentence counts.
 */
export function BackTranslation({
  promptId,
  items,
  mode,
  intro,
  onDone,
}: {
  promptId: string;
  items: BackItem[];
  mode: DictationMode;
  /** Why these sentences, shown with the instructions. */
  intro?: string;
  onDone: (results: BackResult[]) => void;
}) {
  const t = useTranslations("writing.back");
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [results, setResults] = useState<BackResult[]>([]);
  const [loop, setLoop] = useState(false);
  const item = items[index];
  const asked = item ? itemMode(item, mode) : mode;
  const result = results[index];
  const listening = asked !== "read-zh";
  const sound = useWordSound(promptId, item?.en ?? null, {
    loop,
    gapMs: LOOP_GAP_MS,
    audioUrl: writingSentenceAudioUrl,
    // Reading the Chinese: the English is a hint, played only on request.
    autoplay: listening,
  });

  if (!item) return null;

  const check = () => {
    if (result || !answer.trim()) return;
    setLoop(false);
    setResults([...results, checkBack(item, mode, answer)]);
  };
  const next = () => {
    setAnswer("");
    setLoop(false);
    if (index + 1 >= items.length) onDone(results);
    else setIndex(index + 1);
  };
  const keys = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter checks (or goes on); Shift+Enter is a new line.
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (result) next();
    else check();
  };

  const controls = (
    <div className="flex flex-col gap-2 rounded-base border border-line bg-surface p-3">
      {asked === "read-zh" && (
        <p className="text-sentence" lang="zh-Hant">
          {item.zh}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={listening ? "primary" : "secondary"}
          onClick={sound.play}
          disabled={!sound.ready}
        >
          {listening ? t("replay") : t("hint")}
        </Button>
        {listening && (
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={loop}
            onClick={() => setLoop(!loop)}
          >
            {loop ? t("loopOn") : t("loopOff")}
          </Button>
        )}
        <span className="ml-auto text-supporting text-ink-muted tabular-nums">
          {t("count", { n: index + 1, total: items.length })}
        </span>
      </div>
    </div>
  );

  return (
    <WritingWorkspace
      summary={`${t("count", { n: index + 1, total: items.length })} · ${t(`modes.${asked}.name`)}`}
      label={t(`modes.${asked}.label`)}
      audio={controls}
      task={
        <div className="flex flex-col gap-3">
          <p>{t(`modes.${asked}.intro`)}</p>
          {asked !== mode && (
            <p className="text-supporting text-ink-muted">{t("noMeaning")}</p>
          )}
          {intro && <p className="text-supporting text-ink-muted">{intro}</p>}
          <p className="text-supporting text-ink-muted">{t("rules")}</p>
          <p className="text-supporting">
            <Link href="/account#writing-settings" className="underline">
              {t("changeMode")}
            </Link>
          </p>
        </div>
      }
    >
      <label
        htmlFor="back-answer"
        className="sr-only shrink-0 font-medium wide:not-sr-only"
      >
        {t(`modes.${asked}.label`)}
      </label>
      {/* The box and Check side by side: one row less on a phone. */}
      <div className="flex min-h-14 flex-1 items-stretch gap-2 wide:flex-none">
        <textarea
          id="back-answer"
          lang={asked === "listen-zh" ? "zh-Hant" : "en"}
          rows={3}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={keys}
          readOnly={Boolean(result)}
          spellCheck={false}
          autoCapitalize={asked === "listen-zh" ? "off" : "sentences"}
          autoComplete="off"
          placeholder={t(`modes.${asked}.label`)}
          className="min-h-14 w-full min-w-0 flex-1 resize-none rounded-base border border-line bg-surface p-3 text-sentence focus:border-ink"
        />
        {!result && (
          <Button
            variant="primary"
            onClick={check}
            disabled={!answer.trim()}
            className="shrink-0 self-end"
          >
            {t("check")}
          </Button>
        )}
      </div>
      {result && (
        <div
          role="status"
          ref={(element) =>
            // The result and "Next" in view inside the answer column.
            element?.scrollIntoView({ block: "nearest" })
          }
          className="flex shrink-0 flex-col gap-3"
        >
          <p className={result.right ? "text-success" : ""}>
            {result.right ? t("right") : t("close")}{" "}
            <span className="tabular-nums">
              {t("score", { percent: Math.round(result.score * 100) })}
            </span>
          </p>
          <div>
            <Button variant="primary" onClick={next}>
              {index + 1 >= items.length ? t("finish") : t("next")}
            </Button>
          </div>
          {result.mode === "listen-zh" ? (
            <dl className="grid gap-1 text-supporting">
              <dt className="text-ink-muted">{t("meaning")}</dt>
              <dd lang="zh-Hant">{item.zh}</dd>
              <dt className="text-ink-muted">{t("english")}</dt>
              <dd lang="en">{item.en}</dd>
            </dl>
          ) : (
            <>
              <WordDiffView diff={wordDiff(item.en, answer)} />
              {item.zh && (
                <p className="text-supporting text-ink-muted" lang="zh-Hant">
                  {item.zh}
                </p>
              )}
            </>
          )}
          {item.source === "fix" && (
            <p className="text-supporting text-ink-muted">{t("fromFix")}</p>
          )}
        </div>
      )}
    </WritingWorkspace>
  );
}

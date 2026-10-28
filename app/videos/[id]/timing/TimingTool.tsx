"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { SentenceRow } from "@/components/SentenceRow";
import { YouTubeFrame } from "@/components/youtube/YouTubeFrame";
import { useYouTubePlayer } from "@/components/youtube/useYouTubePlayer";
import { paddedSegment } from "@/lib/player/padding";
import { applyTaps } from "@/lib/player/tap-timing";
import { validateVideo, type Sentence, type Video } from "@/lib/videos";

const STEP = 0.1;
// Keep two decimals so repeated nudges don't drift (0.1 + 0.2 ≠ 0.3).
const round = (seconds: number) => Math.round(seconds * 100) / 100;

/**
 * Developer tool for tuning sentence timestamps by ear. Tap mode does the
 * rough pass: play from a point and press Space as each sentence starts
 * (Enter when the last one ends). Then play each sentence, nudge start/end
 * by 0.1 s, and copy the sentences JSON back into data/videos/<id>.json.
 */
export function TimingTool({ video }: { video: Video }) {
  const t = useTranslations("timing");
  const player = useYouTubePlayer(video.youtubeId);
  const [sentences, setSentences] = useState<Sentence[]>(video.sentences);
  const [current, setCurrent] = useState(0);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  // Tap mode: null when idle, else the starts tapped so far.
  const [taps, setTaps] = useState<number[] | null>(null);
  const [tapFrom, setTapFrom] = useState(() =>
    Math.max(0, Math.floor((video.sentences[0]?.start ?? 1) - 1)),
  );
  const [tapDone, setTapDone] = useState<number | null>(null);
  const tapsRef = useRef<number[] | null>(null);
  useEffect(() => {
    tapsRef.current = taps;
  }, [taps]);

  const json = JSON.stringify(sentences, null, 2);
  const problems = validateVideo({ ...video, sentences }).filter((p) =>
    p.startsWith("sentences"),
  );

  function nudge(index: number, field: "start" | "end", delta: number) {
    setSentences((list) =>
      list.map((s, i) =>
        i === index
          ? { ...s, [field]: round(Math.max(0, s[field] + delta)) }
          : s,
      ),
    );
    setCopyState("idle");
  }

  // Same padding as practice pages, so what you hear here is what learners hear.
  function play(index: number) {
    setCurrent(index);
    const { start, end } = paddedSegment(sentences, index);
    player.playSegment(start, end);
  }

  function startTapping() {
    setTaps([]);
    setTapDone(null);
    setCopyState("idle");
    player.playFrom(tapFrom);
  }

  /** Space (or the big button): the next sentence starts now. */
  function tap() {
    const list = tapsRef.current;
    if (!list || list.length >= sentences.length) return;
    setTaps([...list, player.currentTime()]);
  }

  /** Enter (or "last sentence ended"): apply the taps and stop. */
  function finishTapping() {
    const list = tapsRef.current;
    if (!list || list.length === 0) return;
    player.stop();
    setSentences((current) => applyTaps(current, list, player.currentTime()));
    setTapDone(list.length);
    setTaps(null);
  }

  /** Take back the last tap and replay from a moment before it. */
  function undoTap() {
    const list = tapsRef.current;
    if (!list || list.length === 0) return;
    const rest = list.slice(0, -1);
    setTaps(rest);
    player.playFrom(Math.max(tapFrom, (rest.at(-1) ?? tapFrom) - 1));
  }

  function cancelTapping() {
    player.stop();
    setTaps(null);
  }

  // While tapping, Space taps and Enter finishes (no scrolling or clicking).
  useEffect(() => {
    if (!taps) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        tap();
      } else if (event.key === "Enter") {
        event.preventDefault();
        finishTapping();
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
    // tap/finishTapping read refs; re-binding only when tapping starts/stops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taps === null]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="mt-8 space-y-8">
      <div className="bg-ground split:sticky split:top-4 split:z-10">
        <YouTubeFrame {...player} />
      </div>

      <section className="space-y-4 rounded-base border border-line bg-surface p-4">
        <h2 className="font-display text-h3">{t("tapTitle")}</h2>
        <p className="max-w-reading text-supporting text-ink-muted">
          {t("tapIntro")}
        </p>
        {taps === null ? (
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-supporting">
              {t("tapFrom")}
              <input
                type="number"
                min={0}
                step={0.5}
                value={tapFrom}
                onChange={(event) =>
                  setTapFrom(Number(event.target.value) || 0)
                }
                className="w-24 rounded-base border border-line bg-ground px-2 py-1 tabular-nums"
              />
            </label>
            <Button
              variant="primary"
              disabled={player.status !== "ready"}
              onClick={startTapping}
            >
              {t("tapStart")}
            </Button>
            {tapDone !== null && (
              <span role="status" className="text-supporting text-success">
                {t("tapDone", { count: tapDone })}
              </span>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-supporting" aria-live="polite">
              {taps.length < sentences.length ? (
                <>
                  {t("tapNext", {
                    n: taps.length + 1,
                    total: sentences.length,
                  })}{" "}
                  <span lang="en">{sentences[taps.length].en}</span>
                </>
              ) : (
                t("tapEnd")
              )}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                size="lg"
                disabled={taps.length >= sentences.length}
                onClick={tap}
              >
                {t("tapButton")}
              </Button>
              <Button
                variant="secondary"
                disabled={taps.length === 0}
                onClick={finishTapping}
              >
                {t("tapEndButton")}
              </Button>
              <Button
                variant="ghost"
                disabled={taps.length === 0}
                onClick={undoTap}
              >
                {t("tapUndo")}
              </Button>
              <Button variant="ghost" onClick={cancelTapping}>
                {t("tapCancel")}
              </Button>
            </div>
          </div>
        )}
      </section>

      <ol className="border-t border-line">
        {sentences.map((sentence, index) => (
          <li key={sentence.i} className="border-b border-line pb-4">
            <SentenceRow
              index={index}
              status={index === current ? "current" : "pending"}
            >
              {sentence.en}
            </SentenceRow>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pl-4 text-supporting">
              <Button
                size="sm"
                variant="primary"
                disabled={player.status !== "ready"}
                onClick={() => play(index)}
              >
                {t("play")}
              </Button>
              {(["start", "end"] as const).map((field) => (
                <span key={field} className="flex items-center gap-2">
                  <span className="text-ink-muted">{t(field)}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`${t(field)} ${t("earlier")}`}
                    onClick={() => nudge(index, field, -STEP)}
                  >
                    −
                  </Button>
                  <output
                    className="min-w-16 text-center tabular-nums"
                    aria-live="polite"
                  >
                    {sentence[field].toFixed(2)}
                  </output>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`${t(field)} ${t("later")}`}
                    onClick={() => nudge(index, field, STEP)}
                  >
                    +
                  </Button>
                </span>
              ))}
              <span className="text-ink-muted tabular-nums">
                {t("plays", {
                  start: paddedSegment(sentences, index).start.toFixed(2),
                  end: paddedSegment(sentences, index).end.toFixed(2),
                })}
              </span>
            </div>
          </li>
        ))}
      </ol>

      <section className="space-y-4">
        {problems.length > 0 ? (
          <div role="alert" className="text-supporting text-error">
            <p>{t("problems")}</p>
            <ul lang="en" className="mt-1 list-disc pl-6">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-supporting text-success">{t("ok")}</p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="primary" onClick={copy}>
            {t("copy")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setSentences(video.sentences);
              setCopyState("idle");
            }}
          >
            {t("reset")}
          </Button>
          <span role="status" className="text-supporting text-ink-muted">
            {copyState === "copied" && t("copied")}
            {copyState === "failed" && t("copyFailed")}
          </span>
        </div>
        <textarea
          readOnly
          value={json}
          aria-label={t("copy")}
          rows={10}
          className="font-mono w-full rounded-base border border-line bg-surface p-3 text-metadata"
        />
      </section>
    </div>
  );
}

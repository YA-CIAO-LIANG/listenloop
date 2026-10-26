"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/Button";
import { SentenceRow } from "@/components/SentenceRow";
import { YouTubeFrame } from "@/components/youtube/YouTubeFrame";
import { useYouTubePlayer } from "@/components/youtube/useYouTubePlayer";
import { paddedSegment } from "@/lib/player/padding";
import { validateVideo, type Sentence, type Video } from "@/lib/videos";

const STEP = 0.1;
// Keep two decimals so repeated nudges don't drift (0.1 + 0.2 ≠ 0.3).
const round = (seconds: number) => Math.round(seconds * 100) / 100;

/**
 * Developer tool for tuning sentence timestamps by ear: play a sentence,
 * nudge start/end by 0.1 s, then copy the sentences JSON back into
 * data/videos/<id>.json.
 */
export function TimingTool({ video }: { video: Video }) {
  const t = useTranslations("timing");
  const player = useYouTubePlayer(video.youtubeId);
  const [sentences, setSentences] = useState<Sentence[]>(video.sentences);
  const [current, setCurrent] = useState(0);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

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

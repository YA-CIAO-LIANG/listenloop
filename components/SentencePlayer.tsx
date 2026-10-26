"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  DEFAULT_PADDING,
  paddedSegment,
  type Padding,
} from "@/lib/player/padding";
import type { Sentence } from "@/lib/videos";
import { Button } from "./Button";
import { SegmentedControl } from "./SegmentedControl";
import type {
  PlaybackRate,
  YouTubePlayerApi,
} from "./youtube/useYouTubePlayer";

const RATES = [
  { value: "1", rate: 1, key: "normal" },
  { value: "0.75", rate: 0.75, key: "slow" },
  { value: "0.5", rate: 0.5, key: "slower" },
] as const;

type SentencePlayerProps = {
  player: YouTubePlayerApi;
  /** All sentences of the video; neighbors limit the padding. */
  sentences: readonly Sentence[];
  index: number;
  padding?: Padding;
};

/**
 * Plays one sentence of the video (with padding, see lib/player/padding.ts),
 * with replay and 1× / 0.75× / 0.5× speed.
 */
export function SentencePlayer({
  player,
  sentences,
  index,
  padding = DEFAULT_PADDING,
}: SentencePlayerProps) {
  const t = useTranslations("player");
  const [rate, setRate] = useState<PlaybackRate>(1);
  const [playedIndex, setPlayedIndex] = useState<number | null>(null);
  const played = playedIndex === index;

  function play() {
    const { start, end } = paddedSegment(sentences, index, padding);
    player.playSegment(start, end, rate);
    setPlayedIndex(index);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <p className="text-metadata tracking-widest text-ink-muted uppercase">
        {t("position", { n: index + 1, total: sentences.length })}
      </p>
      <Button
        variant="primary"
        size="lg"
        disabled={player.status !== "ready"}
        onClick={play}
      >
        {player.isPlaying ? t("playing") : played ? t("replay") : t("play")}
      </Button>
      <SegmentedControl
        legend={t("speed")}
        value={String(rate)}
        options={RATES.map(({ value, key }) => ({
          value,
          label: t(`speeds.${key}`),
        }))}
        onChange={(value) =>
          setRate(RATES.find((r) => r.value === value)?.rate ?? 1)
        }
        optionWidthClassName="min-w-14"
      />
    </div>
  );
}

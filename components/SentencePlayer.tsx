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
import type { YouTubePlayerApi } from "./youtube/useYouTubePlayer";

type SentencePlayerProps = {
  player: YouTubePlayerApi;
  /** All sentences of the video; neighbors limit the padding. */
  sentences: readonly Sentence[];
  index: number;
  padding?: Padding;
};

/**
 * Plays one sentence of the video (with padding, see lib/player/padding.ts),
 * and replays it on demand.
 */
export function SentencePlayer({
  player,
  sentences,
  index,
  padding = DEFAULT_PADDING,
}: SentencePlayerProps) {
  const t = useTranslations("player");
  const [playedIndex, setPlayedIndex] = useState<number | null>(null);
  const played = playedIndex === index;

  function play() {
    const { start, end } = paddedSegment(sentences, index, padding);
    player.playSegment(start, end);
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
    </div>
  );
}

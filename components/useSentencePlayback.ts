"use client";

import { useCallback, useState } from "react";
import {
  DEFAULT_PADDING,
  paddedSegment,
  type Padding,
} from "@/lib/player/padding";
import type { Sentence } from "@/lib/videos";
import type { YouTubePlayerApi } from "./youtube/useYouTubePlayer";

/**
 * Sentence playback for practice pages: plays a sentence with padding (see
 * lib/player/padding.ts) and remembers whether the current one was played,
 * so the button can say "Play" or "Replay". Pages lay out their own buttons.
 */
export function useSentencePlayback(
  player: Pick<YouTubePlayerApi, "playSegment">,
  sentences: readonly Sentence[],
  index: number,
  padding: Padding = DEFAULT_PADDING,
) {
  const [playedIndex, setPlayedIndex] = useState<number | null>(null);
  const { playSegment } = player;

  const playAt = useCallback(
    (target: number, onEnd?: () => void) => {
      const { start, end } = paddedSegment(sentences, target, padding);
      playSegment(start, end, onEnd);
      setPlayedIndex(target);
    },
    [playSegment, sentences, padding],
  );

  const play = useCallback(
    (onEnd?: () => void) => playAt(index, onEnd),
    [playAt, index],
  );

  return { play, playAt, played: playedIndex === index };
}

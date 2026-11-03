"use client";

import { useCallback, useState } from "react";
import type { SentencePlayer } from "./useSentencePlayer";

/**
 * Sentence playback for practice pages: plays a sentence and remembers
 * whether the current one was played, so the button can say "Play" or
 * "Replay". Pages lay out their own buttons.
 */
export function useSentencePlayback(
  player: Pick<SentencePlayer, "playSentence">,
  index: number,
) {
  const [playedIndex, setPlayedIndex] = useState<number | null>(null);
  const { playSentence } = player;

  const playAt = useCallback(
    (target: number, onEnd?: () => void) => {
      playSentence(target, onEnd);
      setPlayedIndex(target);
    },
    [playSentence],
  );

  const play = useCallback(
    (onEnd?: () => void) => playAt(index, onEnd),
    [playAt, index],
  );

  return { play, playAt, played: playedIndex === index };
}

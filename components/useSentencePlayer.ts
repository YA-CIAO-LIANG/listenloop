"use client";

import { useCallback } from "react";
import { DEFAULT_PADDING, paddedSegment } from "@/lib/player/padding";
import type { PracticeMaterial } from "@/lib/practice-material";
import { useAudioPlayer } from "./audio/useAudioPlayer";
import {
  useYouTubePlayer,
  type PlayerError,
  type PlayerStatus,
} from "./youtube/useYouTubePlayer";

/** Sentence-by-sentence playback, whatever the material plays from. */
export type SentencePlayer = {
  kind: "youtube" | "audio";
  status: PlayerStatus;
  error: PlayerError | null;
  isPlaying: boolean;
  /** Plays sentence `index`, then calls `onEnd` (not if stopped first). */
  playSentence: (index: number, onEnd?: () => void) => void;
  stop: () => void;
  /** The YouTube player's mount point; unused for audio. */
  containerRef: (element: HTMLDivElement | null) => void;
};

/**
 * A YouTube video plays each sentence's padded time range
 * (lib/player/padding.ts); a created practice plays each sentence's own
 * audio file. Both hooks are always called (hooks can't be conditional);
 * the unused one stays idle: YouTube loads nothing until its frame mounts,
 * and audio has no files.
 */
export function useSentencePlayer(material: PracticeMaterial): SentencePlayer {
  const youtube = useYouTubePlayer(material.youtubeId ?? "");
  const audio = useAudioPlayer(material.audioUrls ?? NO_URLS);
  const { sentences } = material;
  const { playSegment } = youtube;

  const playYouTubeSentence = useCallback(
    (index: number, onEnd?: () => void) => {
      const { start, end } = paddedSegment(sentences, index, DEFAULT_PADDING);
      playSegment(start, end, onEnd);
    },
    [playSegment, sentences],
  );

  if (material.audioUrls) {
    return { kind: "audio", ...audio, containerRef: noop };
  }
  return {
    kind: "youtube",
    status: youtube.status,
    error: youtube.error,
    isPlaying: youtube.isPlaying,
    playSentence: playYouTubeSentence,
    stop: youtube.stop,
    containerRef: youtube.containerRef,
  };
}

const NO_URLS: readonly string[] = [];
const noop = () => {};

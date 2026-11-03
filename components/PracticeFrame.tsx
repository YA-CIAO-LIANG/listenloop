"use client";

import { AudioFrame } from "./audio/AudioFrame";
import { CaptionHint } from "./CaptionHint";
import type { SentencePlayer } from "./useSentencePlayer";
import { YouTubeFrame } from "./youtube/YouTubeFrame";

/**
 * The player on practice pages: the YouTube video with the hint to turn
 * captions off, or the audio panel for created practices.
 */
export function PracticeFrame({ player }: { player: SentencePlayer }) {
  if (player.kind === "audio") {
    return (
      <AudioFrame
        status={player.status}
        error={player.error === "loadFailed" ? "loadFailed" : null}
        isPlaying={player.isPlaying}
      />
    );
  }
  return (
    <>
      <YouTubeFrame
        containerRef={player.containerRef}
        status={player.status}
        error={player.error}
      />
      <CaptionHint />
    </>
  );
}

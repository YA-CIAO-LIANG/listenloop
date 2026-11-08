// Imports carry .ts so scripts/new-video.mts can load lib/videos.ts with plain Node.
import type { Sentence } from "./videos.ts";

/** A published excerpt must run at least this long (seconds). */
export const MIN_EXCERPT_SECONDS = 60;

/**
 * How long the excerpt runs: first sentence's start to last sentence's
 * end, rounded to whole seconds (playback padding not included). The card
 * label and the library's length choice (D104) both use this value, so
 * they always agree.
 */
export function excerptSeconds(sentences: readonly Sentence[]): number {
  const first = sentences[0];
  const last = sentences.at(-1);
  if (!first || !last) return 0;
  return Math.round(last.end - first.start);
}

/** Minutes and seconds for the card label ("1 分 40 秒", "2 分鐘"). */
export function minutesAndSeconds(seconds: number): {
  minutes: number;
  seconds: number;
} {
  return { minutes: Math.floor(seconds / 60), seconds: seconds % 60 };
}

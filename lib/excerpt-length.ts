// Imports carry .ts so scripts/new-video.mts can load lib/videos.ts with plain Node.
import type { Sentence } from "./videos.ts";

/** A published excerpt must run at least this long (seconds). */
export const MIN_EXCERPT_SECONDS = 60;

/**
 * Length filters for the library, in display order: each holds excerpts
 * from `min` (included) up to `max` (excluded) seconds. Change the steps
 * here only; ids appear in the URL (?length=1-2,8-plus) and in the
 * translation files (library.length.buckets.<id>).
 */
export const LENGTH_BUCKETS = [
  { id: "1-2", min: 60, max: 120 },
  { id: "2-3", min: 120, max: 180 },
  { id: "3-4", min: 180, max: 240 },
  { id: "4-5", min: 240, max: 300 },
  { id: "5-6", min: 300, max: 360 },
  { id: "6-7", min: 360, max: 420 },
  { id: "7-8", min: 420, max: 480 },
  { id: "8-plus", min: 480, max: Infinity },
] as const;

export type LengthBucketId = (typeof LENGTH_BUCKETS)[number]["id"];

/**
 * How long the excerpt runs: first sentence's start to last sentence's
 * end, rounded to whole seconds (playback padding not included). The card
 * label and the length filter both use this value, so they always agree.
 */
export function excerptSeconds(sentences: readonly Sentence[]): number {
  const first = sentences[0];
  const last = sentences.at(-1);
  if (!first || !last) return 0;
  return Math.round(last.end - first.start);
}

/** The length filter an excerpt falls in, or null below the shortest one. */
export function lengthBucket(seconds: number): LengthBucketId | null {
  return (
    LENGTH_BUCKETS.find(({ min, max }) => seconds >= min && seconds < max)
      ?.id ?? null
  );
}

/** Bucket ids from a URL value like "1-2,8-plus"; unknown ids are dropped. */
export function parseLengthFilter(value: string | null): LengthBucketId[] {
  if (!value) return [];
  const wanted = new Set(value.split(","));
  return LENGTH_BUCKETS.map((bucket) => bucket.id).filter((id) =>
    wanted.has(id),
  );
}

/** Minutes and seconds for the card label ("1 分 40 秒", "2 分鐘"). */
export function minutesAndSeconds(seconds: number): {
  minutes: number;
  seconds: number;
} {
  return { minutes: Math.floor(seconds / 60), seconds: seconds % 60 };
}

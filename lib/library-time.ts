import { DAILY_TIME } from "./library-config";

/**
 * A day's practice time for a material (D98): what a library card shows
 * as "about N min a day".
 */
type Material = { seconds: number; sentenceCount: number };

/** Seconds a dictation day (1, 7) or a shadowing day (2–6) takes. */
export function dayEstimateSeconds(
  task: "dictation" | "shadowing",
  { seconds, sentenceCount }: Material,
): number {
  return task === "dictation"
    ? seconds * DAILY_TIME.dictationFactor +
        sentenceCount * DAILY_TIME.dictationSecondsPerSentence
    : seconds * DAILY_TIME.shadowingFactor;
}

/** The week's average day: 2 dictation days and 5 shadowing days. */
export function averageDaySeconds(material: Material): number {
  return (
    (2 * dayEstimateSeconds("dictation", material) +
      5 * dayEstimateSeconds("shadowing", material)) /
    7
  );
}

/** Minutes a day, rounded up (at least 1). */
export function dailyMinutes(material: Material): number {
  return Math.max(1, Math.ceil(averageDaySeconds(material) / 60));
}

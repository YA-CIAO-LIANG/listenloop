import type { Activity } from "./activity";
import { taskForDay, type CycleDay } from "./cycle";
import { DAILY_TIME } from "./library-config";

/**
 * A day's practice time for a material (D98): what the library shows as
 * "about N min a day" and what "how many minutes do I have today?" keeps.
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

/** Minutes a day, rounded up (at least 1), at the learner's pace. */
export function dailyMinutes(material: Material, pace = 1): number {
  return Math.max(1, Math.ceil((averageDaySeconds(material) * pace) / 60));
}

/**
 * The learner's pace (D98): over the days with both a finished task and
 * timed practice on that material, measured seconds ÷ estimated seconds.
 * Null (use the estimate as is) until DAILY_TIME.minTimedDays such days.
 */
export function personalPace(
  activity: Activity,
  materials: ReadonlyMap<string, Material>,
): number | null {
  let measured = 0;
  let estimated = 0;
  let days = 0;
  for (const day of Object.values(activity.days)) {
    if (!day?.tasks || !day.time) continue;
    for (const task of day.tasks) {
      const material = materials.get(task.videoId);
      if (!material) continue;
      const seconds = Object.values(day.time).reduce(
        (sum, device) => sum + (device[task.videoId] ?? 0),
        0,
      );
      if (seconds <= 0) continue;
      const kind =
        taskForDay(task.day as CycleDay) === "shadowing"
          ? "shadowing"
          : "dictation";
      measured += seconds;
      estimated += dayEstimateSeconds(kind, material);
      days += 1;
    }
  }
  if (days < DAILY_TIME.minTimedDays || estimated <= 0) return null;
  return Math.min(
    DAILY_TIME.maxPace,
    Math.max(DAILY_TIME.minPace, measured / estimated),
  );
}

import type { Activity, PracticeTask } from "./activity";
import { CYCLE_DAYS } from "./cycle";
import type { LocalDate } from "./dates";
import type { Progress } from "./progress";

const sameTask = (a: PracticeTask, b: PracticeTask) =>
  a.videoId === b.videoId && a.week === b.week && a.day === b.day;

/**
 * Official tasks finished on each day, for the home calendar: the activity
 * log (which outlives repeated weeks) merged with the completion dates in
 * current progress (practice from before the log existed), without
 * duplicates. Each day's tasks are sorted by video, then week and day.
 */
export function tasksByDate(
  activity: Activity,
  progresses: readonly Progress[],
): Map<LocalDate, PracticeTask[]> {
  const byDate = new Map<LocalDate, PracticeTask[]>();
  const add = (date: LocalDate, task: PracticeTask) => {
    const list = byDate.get(date) ?? [];
    if (!list.some((t) => sameTask(t, task))) list.push(task);
    byDate.set(date, list);
  };

  for (const [date, day] of Object.entries(activity.days)) {
    for (const task of day?.tasks ?? []) add(date, task);
  }
  for (const progress of progresses) {
    for (const day of CYCLE_DAYS) {
      const record = progress.days[day];
      if (record?.done && record.date) {
        add(record.date, {
          videoId: progress.videoId,
          week: progress.week,
          day,
        });
      }
    }
  }

  for (const list of byDate.values()) {
    list.sort(
      (a, b) =>
        a.videoId.localeCompare(b.videoId) || a.week - b.week || a.day - b.day,
    );
  }
  return byDate;
}

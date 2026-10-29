import {
  canStartNextWeek,
  currentDay,
  dayStatuses,
  lastDoneDay,
  type CycleDay,
} from "./cycle";
import type { LocalDate } from "./dates";
import type { Progress } from "./progress";

/** One started practice's task for today, for the home page. */
export type TodayTask = {
  videoId: string;
  title: string;
  /** The week the task belongs to (the new week when one starts again). */
  week: number;
  /** The day to do, or the day finished today. */
  day: CycleDay;
  status: "available" | "done";
  /** Starts the video over for `week` (the previous week wasn't passed). */
  newWeek?: true;
  /** What opens tomorrow, once today's task is done. */
  tomorrow?: { day: CycleDay } | { week: number };
};

type TodayTaskOptions = {
  /** Skip the "different calendar day" rule (NEXT_PUBLIC_DEV_TEST_MODE). */
  ignoreDates?: boolean;
  /** The video's title, or undefined for drafts and removed videos (skipped). */
  titleOf: (videoId: string) => string | undefined;
};

function taskFor(
  progress: Progress,
  today: LocalDate,
  ignoreDates: boolean,
): Omit<TodayTask, "title"> | null {
  const { videoId, week } = progress;
  if (progress.status === "passed") return null;

  if (progress.status === "repeat") {
    if (canStartNextWeek(progress, today, { ignoreDates })) {
      return {
        videoId,
        week: week + 1,
        day: 1,
        status: "available",
        newWeek: true,
      };
    }
    return progress.days[7]?.date === today
      ? { videoId, week, day: 7, status: "done", tomorrow: { week: week + 1 } }
      : null;
  }

  const current = currentDay(dayStatuses(progress, today, { ignoreDates }));
  if (current) return { videoId, week, day: current, status: "available" };

  const last = lastDoneDay(progress);
  if (!last || progress.days[last]?.date !== today) return null;
  return {
    videoId,
    week,
    day: last,
    status: "done",
    ...(last < 7 && { tomorrow: { day: (last + 1) as CycleDay } }),
  };
}

/**
 * Today's task for every started practice: what can be done now first,
 * then what was finished today, each group by title. Passed videos have
 * nothing left to do and aren't listed.
 */
export function todayTasks(
  progresses: readonly Progress[],
  today: LocalDate,
  { ignoreDates = false, titleOf }: TodayTaskOptions,
): TodayTask[] {
  const tasks: TodayTask[] = [];
  for (const progress of progresses) {
    const title = titleOf(progress.videoId);
    if (!title) continue;
    const task = taskFor(progress, today, ignoreDates);
    if (task) tasks.push({ ...task, title });
  }
  const order = { available: 0, done: 1 } as const;
  return tasks.sort(
    (a, b) =>
      order[a.status] - order[b.status] || a.title.localeCompare(b.title),
  );
}

/** Day 7 accuracy at or above this passes the week (see CLAUDE.md 週結算). */
export const PASS_THRESHOLD = 0.8;

export const DAYS_PER_CYCLE = 7;

export type CycleDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type DayTask = "dictation" | "shadowing" | "redictation";

export type DayStatus = "locked" | "available" | "today" | "done";

/** Score is a ratio between 0 and 1. */
export function isPassingScore(score: number): boolean {
  return score >= PASS_THRESHOLD;
}

/** Day 1 is dictation, Days 2–6 are shadowing, Day 7 is re-dictation. */
export function taskForDay(day: CycleDay): DayTask {
  if (day === 1) return "dictation";
  if (day === DAYS_PER_CYCLE) return "redictation";
  return "shadowing";
}

import type { Activity, DayActivity, PracticeTask } from "../activity";
import type { LocalDate } from "../dates";
import type { Progress } from "../progress";

/**
 * How far a video's progress has got, compared item by item: week, then
 * days done, then the latest done date, then sentences answered in a day
 * still in progress. Official progress only moves forward, so the copy
 * with more of it is the newer one (docs/decisions.md D3).
 */
function rank(progress: Progress): (number | string)[] {
  const days = Object.values(progress.days).filter((day) => day !== undefined);
  const done = days.filter((day) => day.done);
  const latest = done.reduce<string>(
    (max, day) => (day.date && day.date > max ? day.date : max),
    "",
  );
  const answered = days.reduce(
    (sum, day) =>
      sum +
      (day.answers?.filter((answer) => answer !== null).length ?? 0) +
      (day.sentences?.filter((sentence) => sentence.done).length ?? 0),
    0,
  );
  return [progress.week, done.length, latest, answered];
}

function compareRank(a: Progress, b: Progress): number {
  const [ra, rb] = [rank(a), rank(b)];
  for (let i = 0; i < ra.length; i++) {
    if (ra[i] !== rb[i]) return ra[i] > rb[i] ? 1 : -1;
  }
  return 0;
}

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * What to copy or remove where so this device and the account agree.
 * `base` lists the videos both sides had after the last sync on this
 * device; it tells a removal from something new:
 * - on one side only and in `base`: removed on the other side (here, or
 *   on another device), so remove it here too instead of copying it back;
 * - on one side only and not in `base`: new, so copy it over;
 * - on both: the copy with more progress wins; a tie goes to the cloud so
 *   every device settles on the same copy.
 */
export function planProgressSync(
  local: readonly Progress[],
  cloud: readonly Progress[],
  base: ReadonlySet<string> = new Set(),
): {
  toLocal: Progress[];
  toCloud: Progress[];
  removeLocal: string[];
  removeCloud: string[];
} {
  const cloudById = new Map(cloud.map((p) => [p.videoId, p]));
  const localIds = new Set(local.map((p) => p.videoId));
  const plan = {
    toLocal: [] as Progress[],
    toCloud: [] as Progress[],
    removeLocal: [] as string[],
    removeCloud: [] as string[],
  };
  for (const theirs of cloud) {
    if (localIds.has(theirs.videoId)) continue;
    if (base.has(theirs.videoId)) plan.removeCloud.push(theirs.videoId);
    else plan.toLocal.push(theirs);
  }
  for (const mine of local) {
    const theirs = cloudById.get(mine.videoId);
    if (!theirs) {
      if (base.has(mine.videoId)) plan.removeLocal.push(mine.videoId);
      else plan.toCloud.push(mine);
    } else if (same(mine, theirs)) continue;
    else if (compareRank(mine, theirs) > 0) plan.toCloud.push(mine);
    else plan.toLocal.push(theirs);
  }
  return plan;
}

const taskKey = (task: PracticeTask) =>
  `${task.videoId}:${task.week}:${task.day}`;

function mergeDay(a: DayActivity, b: DayActivity): DayActivity {
  const tasks = new Map(
    [...(a.tasks ?? []), ...(b.tasks ?? [])].map((t) => [taskKey(t), t]),
  );
  const merged: DayActivity = {
    official: a.official || b.official,
    retries: [...new Set([...a.retries, ...b.retries])],
  };
  if (tasks.size > 0) merged.tasks = [...tasks.values()];
  return merged;
}

/** Both logs together: every day from either, each day's entries combined. */
export function mergeActivity(a: Activity, b: Activity): Activity {
  const days: Activity["days"] = { ...a.days };
  for (const [date, day] of Object.entries(b.days) as [
    LocalDate,
    DayActivity | undefined,
  ][]) {
    if (!day) continue;
    const mine = days[date];
    days[date] = mine ? mergeDay(mine, day) : day;
  }
  return { days };
}

export { same as sameData };

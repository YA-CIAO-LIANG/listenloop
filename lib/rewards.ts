import { officialDates, type Activity } from "./activity";
import { CYCLE_DAYS } from "./cycle";
import { daysBetween, type LocalDate } from "./dates";
import type { Progress } from "./progress";
import { averageCoverage, isShadowingDay } from "./shadowing";

/**
 * Every reward number in one place (docs/aquarium.md → 點數與飼料).
 * Points only buy fish; feed (1 portion a day) is for feeding them.
 */
export const REWARDS = {
  /** Finishing a day's official task. */
  day: 10,
  /** Day 1 and Day 7: plus round(accuracy × this). */
  dictationBonus: 10,
  /** Shadowing day whose recognized average coverage reaches the bar. */
  shadowingBonus: 5,
  shadowingBonusCoverage: 0.9,
  weekPassed: 50,
  weekRepeat: 20,
  /** Consecutive official days: from the 3rd day on, a flat bonus each day. */
  streakFrom: 3,
  streakBonus: 5,
  /** First finished retry of a video on a day. */
  retry: 2,
  /** Feed: one portion per day with an official task, plus one to start. */
  feedPerDay: 1,
  starterFeed: 1,
  /** Feed stops accumulating here. */
  feedCap: 2,
} as const;

/** A reward someone has earned; `id` makes claiming it idempotent. */
export type Reward = { id: string; amount: number; date: LocalDate };

const byDate = (a: Reward, b: Reward) => a.date.localeCompare(b.date);

function dayPoints(progress: Progress): Reward[] {
  const { videoId, week } = progress;
  return CYCLE_DAYS.flatMap((day) => {
    const record = progress.days[day];
    if (!record?.done || !record.date) return [];
    let amount = REWARDS.day;
    if ((day === 1 || day === 7) && record.score !== undefined) {
      amount += Math.round(record.score * REWARDS.dictationBonus);
    }
    if (isShadowingDay(day) && record.sentences) {
      const average = averageCoverage(record.sentences);
      if (average !== null && average >= REWARDS.shadowingBonusCoverage) {
        amount += REWARDS.shadowingBonus;
      }
    }
    return [
      { id: `day:${videoId}:w${week}:d${day}`, amount, date: record.date },
    ];
  });
}

function weekPoints(progress: Progress): Reward[] {
  return progress.history.map((week) => ({
    id: `week:${progress.videoId}:w${week.week}`,
    amount: week.passed ? REWARDS.weekPassed : REWARDS.weekRepeat,
    // The settle date isn't kept for past weeks; their start date orders them.
    date:
      week.week === progress.week && progress.days[7]?.date
        ? progress.days[7].date
        : week.startedAt,
  }));
}

/** Streak rewards for consecutive calendar days with an official task. */
export function streakPoints(dates: readonly LocalDate[]): Reward[] {
  const rewards: Reward[] = [];
  let run = 0;
  dates.forEach((date, i) => {
    run = i > 0 && daysBetween(dates[i - 1], date) === 1 ? run + 1 : 1;
    if (run >= REWARDS.streakFrom) {
      rewards.push({
        id: `streak:${date}`,
        amount: REWARDS.streakBonus,
        date,
      });
    }
  });
  return rewards;
}

function retryPoints(activity: Activity): Reward[] {
  return Object.entries(activity.days).flatMap(([date, day]) =>
    (day?.retries ?? []).map((videoId) => ({
      id: `retry:${videoId}:${date}`,
      amount: REWARDS.retry,
      date,
    })),
  );
}

/** All point rewards the records support, oldest first. */
export function pointRewards(
  progresses: readonly Progress[],
  activity: Activity,
): Reward[] {
  return [
    ...progresses.flatMap((p) => [...dayPoints(p), ...weekPoints(p)]),
    ...streakPoints(officialDates(activity, progresses)),
    ...retryPoints(activity),
  ].sort(byDate);
}

/**
 * Feed rewards, oldest first: the starter portion, then one per day with an
 * official task (whichever video, retries don't count).
 */
export function feedRewards(
  progresses: readonly Progress[],
  activity: Activity,
  today: LocalDate,
): Reward[] {
  const dates = officialDates(activity, progresses);
  return [
    {
      id: "feed:starter",
      amount: REWARDS.starterFeed,
      date: dates[0] ?? today,
    },
    ...dates.map((date) => ({
      id: `feed:${date}`,
      amount: REWARDS.feedPerDay,
      date,
    })),
  ];
}

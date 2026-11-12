import { usageDay } from "./usage";

/**
 * What /admin/usage shows (D38): estimated spend against the Azure for
 * Students credit and the free speech tier. All the numbers live here.
 */
export const AZURE_CREDIT = {
  usd: 100,
  /** The credit ends on this day (Joe's subscription). */
  endsOn: "2027-11-04",
} as const;

/** Azure Speech F0: free characters a month, then it stops. */
export const AZURE_SPEECH_FREE_CHARS = 500_000;

/** How many recent calls the page lists. */
export const RECENT_CALLS = 50;

/** Taiwan is UTC+8 all year (no daylight saving). */
const TAIPEI_OFFSET = "+08:00";

/**
 * When the usage day and month of `now` began, in Taiwan time, as ISO
 * instants, for the totals query.
 */
export function usagePeriodStarts(now: Date): {
  dayStart: string;
  monthStart: string;
} {
  const day = usageDay(now);
  return {
    dayStart: new Date(`${day}T00:00:00${TAIPEI_OFFSET}`).toISOString(),
    monthStart: new Date(
      `${day.slice(0, 7)}-01T00:00:00${TAIPEI_OFFSET}`,
    ).toISOString(),
  };
}

/**
 * The week of `now` for the free plan's minutes (D143): from Monday 00:00
 * Taiwan time, like every other allowance (D139 keeps them on Taiwan
 * time), to the next Monday 00:00, as ISO instants.
 */
export function usageWeek(now: Date): { start: string; end: string } {
  const day = usageDay(now);
  const date = new Date(`${day}T00:00:00Z`);
  // Monday is 0 … Sunday is 6.
  const sinceMonday = (date.getUTCDay() + 6) % 7;
  const monday = new Date(date.getTime() - sinceMonday * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const start = new Date(`${monday}T00:00:00${TAIPEI_OFFSET}`);
  return {
    start: start.toISOString(),
    end: new Date(start.getTime() + 7 * 86_400_000).toISOString(),
  };
}

export const microsToUsd = (micros: number) => micros / 1_000_000;

/** The credit left after the estimated Azure spend so far; never negative. */
export function creditLeftUsd(azureMicros: number): number {
  return Math.max(0, AZURE_CREDIT.usd - microsToUsd(azureMicros));
}

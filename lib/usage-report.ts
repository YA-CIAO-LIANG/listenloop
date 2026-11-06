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

export const microsToUsd = (micros: number) => micros / 1_000_000;

/** The credit left after the estimated Azure spend so far; never negative. */
export function creditLeftUsd(azureMicros: number): number {
  return Math.max(0, AZURE_CREDIT.usd - microsToUsd(azureMicros));
}

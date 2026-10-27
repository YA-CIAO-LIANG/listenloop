import { daysBetween, type LocalDate } from "./dates";
import { feedBalance, fishOf, type Wallet } from "./wallet";

/** Fish get hungry this many calendar days after their last meal. */
export const HUNGRY_AFTER_DAYS = 2;

/**
 * Uses one portion of feed (fed:<date>:<n> in feed.used). Null when there
 * is no feed left.
 */
export function feedFish(wallet: Wallet, today: LocalDate): Wallet | null {
  if (feedBalance(wallet) < 1) return null;
  const todays = wallet.feed.used.filter((entry) => entry.date === today);
  return {
    ...wallet,
    feed: {
      ...wallet.feed,
      used: [
        ...wallet.feed.used,
        { id: `fed:${today}:${todays.length + 1}`, amount: 1, date: today },
      ],
    },
  };
}

/** Days the fish were fed (each once), oldest first — the calendar's marks. */
export function fedDates(wallet: Wallet): LocalDate[] {
  return [...new Set(wallet.feed.used.map((entry) => entry.date))].sort();
}

/**
 * The last day the fish ate. Before the first feeding, the day the first
 * fish arrived counts, so a new tank never starts hungry. Null without fish.
 */
export function lastFedDate(wallet: Wallet): LocalDate | null {
  const fed = fedDates(wallet);
  return fed.at(-1) ?? fishOf(wallet).owned[0]?.date ?? null;
}

/**
 * Gently hungry (slower, lower, half-closed eyes) once HUNGRY_AFTER_DAYS
 * calendar days have passed since the last meal; feeding fixes it at once.
 * Fish never die or disappear.
 */
export function isHungry(wallet: Wallet, today: LocalDate): boolean {
  const last = lastFedDate(wallet);
  return last !== null && daysBetween(last, today) >= HUNGRY_AFTER_DAYS;
}

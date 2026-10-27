import { isLocalDate, type LocalDate } from "./dates";
import { REWARDS, type Reward } from "./rewards";

export type LedgerEntry = { id: string; amount: number; date: LocalDate };

/**
 * Saved as ll-wallet:v1 (see CLAUDE.md 資料格式). Append-only ledgers: points
 * are earned and spent on fish; feed is earned and used to feed them.
 */
export type Wallet = {
  points: { earned: LedgerEntry[]; spent: LedgerEntry[] };
  feed: { earned: LedgerEntry[]; used: LedgerEntry[] };
};

export type Gained = { points: number; feed: number };

export function emptyWallet(): Wallet {
  return { points: { earned: [], spent: [] }, feed: { earned: [], used: [] } };
}

const sum = (entries: readonly LedgerEntry[]) =>
  entries.reduce((total, entry) => total + entry.amount, 0);

export function pointBalance(wallet: Wallet): number {
  return sum(wallet.points.earned) - sum(wallet.points.spent);
}

export function feedBalance(wallet: Wallet): number {
  return sum(wallet.feed.earned) - sum(wallet.feed.used);
}

/**
 * Adds rewards not claimed before (by id). Feed stops at REWARDS.feedCap: a
 * portion that doesn't fit is still recorded, as 0, so it never arrives
 * later. Returns the same wallet when nothing is new.
 */
export function claim(
  wallet: Wallet,
  points: readonly Reward[],
  feed: readonly Reward[],
): { wallet: Wallet; gained: Gained } {
  const pointIds = new Set(wallet.points.earned.map((entry) => entry.id));
  const newPoints = points.filter((reward) => !pointIds.has(reward.id));

  const feedIds = new Set(wallet.feed.earned.map((entry) => entry.id));
  let balance = feedBalance(wallet);
  const newFeed = feed
    .filter((reward) => !feedIds.has(reward.id))
    .map((reward) => {
      const amount = Math.max(
        0,
        Math.min(reward.amount, REWARDS.feedCap - balance),
      );
      balance += amount;
      return { ...reward, amount };
    });

  const gained = { points: sum(newPoints), feed: sum(newFeed) };
  if (newPoints.length === 0 && newFeed.length === 0) {
    return { wallet, gained };
  }
  return {
    wallet: {
      points: {
        ...wallet.points,
        earned: [...wallet.points.earned, ...newPoints],
      },
      feed: { ...wallet.feed, earned: [...wallet.feed.earned, ...newFeed] },
    },
    gained,
  };
}

const isEntry = (value: unknown): value is LedgerEntry => {
  if (typeof value !== "object" || value === null) return false;
  const { id, amount, date } = value as Record<string, unknown>;
  return (
    typeof id === "string" &&
    id !== "" &&
    Number.isInteger(amount) &&
    (amount as number) >= 0 &&
    isLocalDate(date)
  );
};

const isLedger = (value: unknown, keys: readonly string[]) =>
  typeof value === "object" &&
  value !== null &&
  keys.every((key) => {
    const list = (value as Record<string, unknown>)[key];
    return Array.isArray(list) && list.every(isEntry);
  });

/** Validates stored data; anything malformed returns null (treated as empty). */
export function parseWallet(data: unknown): Wallet | null {
  if (typeof data !== "object" || data === null) return null;
  const { points, feed } = data as Record<string, unknown>;
  if (!isLedger(points, ["earned", "spent"])) return null;
  if (!isLedger(feed, ["earned", "used"])) return null;
  return data as Wallet;
}

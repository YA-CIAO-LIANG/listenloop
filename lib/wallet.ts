import { isLocalDate, type LocalDate } from "./dates";
import { REWARDS, type Reward } from "./rewards";

export type LedgerEntry = { id: string; amount: number; date: LocalDate };

/** One fish someone owns, e.g. { id: "clownfish:2", species: "clownfish" }. */
export type OwnedFish = { id: string; species: string; date: LocalDate };

export type FishCollection = {
  owned: OwnedFish[];
  /** Ids of owned fish swimming in the aquarium (at most TANK_CAPACITY). */
  inTank: string[];
};

/**
 * Saved as ll-wallet:v1 (see CLAUDE.md 資料格式). Append-only ledgers: points
 * are earned and spent on fish; feed is earned and used to feed them.
 * `fish` was added with the shop, so older wallets don't have it.
 */
export type Wallet = {
  points: { earned: LedgerEntry[]; spent: LedgerEntry[] };
  feed: { earned: LedgerEntry[]; used: LedgerEntry[] };
  fish?: FishCollection;
};

/** The aquarium shows at most this many fish (performance on phones). */
export const TANK_CAPACITY = 12;

/** Everyone starts with one free snail so the tank is never empty. */
export const STARTER_FISH = "snail";

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

export function fishOf(wallet: Wallet): FishCollection {
  return wallet.fish ?? { owned: [], inTank: [] };
}

/** Gives the free starter snail once (same wallet if already given). */
export function ensureStarterFish(wallet: Wallet, today: LocalDate): Wallet {
  if (wallet.fish) return wallet;
  const starter = {
    id: `${STARTER_FISH}:starter`,
    species: STARTER_FISH,
    date: today,
  };
  return { ...wallet, fish: { owned: [starter], inTank: [starter.id] } };
}

/**
 * Buys one fish with points; it joins the aquarium if there's room. Returns
 * null when the points don't cover the price. Points are never refunded.
 */
export function buyFish(
  wallet: Wallet,
  species: string,
  price: number,
  today: LocalDate,
): Wallet | null {
  if (pointBalance(wallet) < price) return null;
  const fish = fishOf(wallet);
  const count = fish.owned.filter((f) => f.species === species).length;
  const id = `${species}:${count + 1}`;
  return {
    ...wallet,
    points: {
      ...wallet.points,
      spent: [
        ...wallet.points.spent,
        { id: `buy:${id}`, amount: price, date: today },
      ],
    },
    fish: {
      owned: [...fish.owned, { id, species, date: today }],
      inTank:
        fish.inTank.length < TANK_CAPACITY ? [...fish.inTank, id] : fish.inTank,
    },
  };
}

/**
 * Puts an owned fish in the aquarium or takes it out. Same wallet when
 * nothing changes (unknown fish, already there, or the tank is full).
 */
export function setInTank(
  wallet: Wallet,
  fishId: string,
  inTank: boolean,
): Wallet {
  const fish = fishOf(wallet);
  const has = fish.inTank.includes(fishId);
  if (!fish.owned.some((f) => f.id === fishId) || has === inTank) return wallet;
  if (inTank && fish.inTank.length >= TANK_CAPACITY) return wallet;
  return {
    ...wallet,
    fish: {
      ...fish,
      inTank: inTank
        ? [...fish.inTank, fishId]
        : fish.inTank.filter((id) => id !== fishId),
    },
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

function isFishCollection(value: unknown): value is FishCollection {
  if (typeof value !== "object" || value === null) return false;
  const { owned, inTank } = value as Record<string, unknown>;
  return (
    Array.isArray(owned) &&
    owned.every((fish) => {
      if (typeof fish !== "object" || fish === null) return false;
      const { id, species, date } = fish as Record<string, unknown>;
      return (
        typeof id === "string" &&
        typeof species === "string" &&
        isLocalDate(date)
      );
    }) &&
    Array.isArray(inTank) &&
    inTank.every((id) => typeof id === "string")
  );
}

/** Validates stored data; anything malformed returns null (treated as empty). */
export function parseWallet(data: unknown): Wallet | null {
  if (typeof data !== "object" || data === null) return null;
  const { points, feed, fish } = data as Record<string, unknown>;
  if (!isLedger(points, ["earned", "spent"])) return null;
  if (!isLedger(feed, ["earned", "used"])) return null;
  if (fish !== undefined && !isFishCollection(fish)) return null;
  return data as Wallet;
}

import { describe, expect, it } from "vitest";
import {
  HUNGRY_AFTER_DAYS,
  fedDates,
  feedFish,
  isHungry,
  lastFedDate,
} from "@/lib/feeding";
import {
  emptyWallet,
  ensureStarterFish,
  feedBalance,
  type Wallet,
} from "@/lib/wallet";

/** A wallet with the starter snail (arrived on `arrived`) and some feed. */
function withFeed(portions: number, arrived = "2026-10-20"): Wallet {
  const wallet = ensureStarterFish(emptyWallet(), arrived);
  return {
    ...wallet,
    feed: {
      earned: Array.from({ length: portions }, (_, i) => ({
        id: `feed:${i}`,
        amount: 1,
        date: arrived,
      })),
      used: [],
    },
  };
}

describe("feedFish", () => {
  it("uses one portion and records the day", () => {
    const fed = feedFish(withFeed(2), "2026-10-27")!;
    expect(feedBalance(fed)).toBe(1);
    expect(fed.feed.used).toEqual([
      { id: "fed:2026-10-27:1", amount: 1, date: "2026-10-27" },
    ]);
    const twice = feedFish(fed, "2026-10-27")!;
    expect(twice.feed.used.at(-1)?.id).toBe("fed:2026-10-27:2");
  });

  it("can't feed without feed", () => {
    expect(feedFish(withFeed(0), "2026-10-27")).toBeNull();
  });
});

describe("fedDates", () => {
  it("lists each day once, oldest first", () => {
    let wallet = withFeed(3);
    wallet = feedFish(wallet, "2026-10-27")!;
    wallet = feedFish(wallet, "2026-10-25")!;
    wallet = feedFish(wallet, "2026-10-27")!;
    expect(fedDates(wallet)).toEqual(["2026-10-25", "2026-10-27"]);
  });
});

describe("hunger", () => {
  it("counts from the day the first fish arrived before any meal", () => {
    const wallet = withFeed(1, "2026-10-20");
    expect(lastFedDate(wallet)).toBe("2026-10-20");
    expect(isHungry(wallet, "2026-10-21")).toBe(false);
    expect(isHungry(wallet, "2026-10-22")).toBe(true);
  });

  it("gets hungry after HUNGRY_AFTER_DAYS days without food, and eating fixes it at once", () => {
    expect(HUNGRY_AFTER_DAYS).toBe(2);
    let wallet = feedFish(withFeed(2), "2026-10-24")!;
    expect(isHungry(wallet, "2026-10-25")).toBe(false);
    expect(isHungry(wallet, "2026-10-26")).toBe(true);
    wallet = feedFish(wallet, "2026-10-26")!;
    expect(isHungry(wallet, "2026-10-26")).toBe(false);
  });

  it("is never hungry without fish", () => {
    expect(lastFedDate(emptyWallet())).toBeNull();
    expect(isHungry(emptyWallet(), "2030-01-01")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { claimRewards, logOfficial, logRetry } from "@/lib/claim-rewards";
import type { CycleDay } from "@/lib/cycle";
import { createProgress, withDay, type Progress } from "@/lib/progress";
import {
  ACTIVITY_KEY,
  WALLET_KEY,
  createLocalRewardStore,
} from "@/lib/storage/local-reward-store";
import type { ProgressStore } from "@/lib/storage/progress-store";

const TODAY = "2026-10-27";

/** In-memory Web Storage, like the browser's. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

function progressStore(progresses: Progress[]): ProgressStore {
  return {
    get: async (id) => progresses.find((p) => p.videoId === id) ?? null,
    save: async () => {},
    list: async () => progresses,
    remove: async () => {},
  };
}

function day1Done(videoId: string, date: string, score = 0.5): Progress {
  return withDay(createProgress(videoId, date), 1 as CycleDay, {
    done: true,
    date,
    score,
  });
}

describe("local reward store", () => {
  it("saves and reads the wallet and the activity log", async () => {
    const storage = memoryStorage();
    const shared = createLocalRewardStore(() => storage);
    expect((await shared.getWallet()).points.earned).toEqual([]);
    await shared.saveActivity({
      days: { [TODAY]: { official: true, retries: [] } },
    });
    expect(storage.getItem(ACTIVITY_KEY)).toContain(TODAY);
    expect((await shared.getActivity()).days[TODAY]?.official).toBe(true);
  });

  it("reads corrupted or blocked storage as empty", async () => {
    const storage = memoryStorage();
    storage.setItem(WALLET_KEY, "{not json");
    expect(
      (await createLocalRewardStore(() => storage).getWallet()).feed.earned,
    ).toEqual([]);

    const blocked = createLocalRewardStore(() => {
      throw new Error("blocked");
    });
    expect((await blocked.getActivity()).days).toEqual({});
    await expect(
      blocked.saveWallet(await blocked.getWallet()),
    ).rejects.toThrow();
  });
});

describe("claimRewards", () => {
  it("back-fills past practice once, then gives nothing new", async () => {
    const storage = memoryStorage();
    const rewards = createLocalRewardStore(() => storage);
    const stores = {
      progress: progressStore([day1Done("sintel", "2026-10-20", 0.5)]),
      rewards,
    };
    const first = await claimRewards(stores, TODAY);
    // 10 + round(0.5 × 10) points; starter + 1 day of feed.
    expect(first.gained).toEqual({ points: 15, feed: 2 });
    expect(first.balance).toEqual({ points: 15, feed: 2 });

    const again = await claimRewards(stores, TODAY);
    expect(again.gained).toEqual({ points: 0, feed: 0 });
    expect(again.balance).toEqual({ points: 15, feed: 2 });
  });

  it("gives feed once a day across videos", async () => {
    const storage = memoryStorage();
    const rewards = createLocalRewardStore(() => storage);
    await claimRewards(
      { progress: progressStore([day1Done("sintel", TODAY)]), rewards },
      TODAY,
      logOfficial(TODAY),
    );
    const second = await claimRewards(
      {
        progress: progressStore([
          day1Done("sintel", TODAY),
          day1Done("voa-001", TODAY),
        ]),
        rewards,
      },
      TODAY,
      logOfficial(TODAY),
    );
    expect(second.gained).toEqual({ points: 15, feed: 0 });
  });

  it("gives the retry bonus once per video per day", async () => {
    const storage = memoryStorage();
    const stores = {
      progress: progressStore([]),
      rewards: createLocalRewardStore(() => storage),
    };
    await claimRewards(stores, TODAY); // starter feed
    const first = await claimRewards(stores, TODAY, logRetry(TODAY, "sintel"));
    expect(first.gained).toEqual({ points: 2, feed: 0 });
    const second = await claimRewards(stores, TODAY, logRetry(TODAY, "sintel"));
    expect(second.gained).toEqual({ points: 0, feed: 0 });
  });

  it("never double-pays overlapping claims", async () => {
    const storage = memoryStorage();
    const stores = {
      progress: progressStore([day1Done("sintel", "2026-10-20")]),
      rewards: createLocalRewardStore(() => storage),
    };
    const results = await Promise.all([
      claimRewards(stores, TODAY),
      claimRewards(stores, TODAY),
      claimRewards(stores, TODAY),
    ]);
    expect(results.map((r) => r.gained.points)).toEqual([15, 0, 0]);
    expect(results[2].balance.points).toBe(15);
  });
});

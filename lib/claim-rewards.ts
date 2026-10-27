import { recordOfficial, recordRetry, type Activity } from "./activity";
import type { LocalDate } from "./dates";
import { feedRewards, pointRewards } from "./rewards";
import type { ProgressStore } from "./storage/progress-store";
import type { RewardStore } from "./storage/reward-store";
import {
  claim,
  ensureStarterFish,
  feedBalance,
  pointBalance,
  type Gained,
  type Wallet,
} from "./wallet";

export type RewardStores = { progress: ProgressStore; rewards: RewardStore };

export type ClaimResult = {
  gained: Gained;
  balance: { points: number; feed: number };
};

// One claim at a time, so overlapping callers (header + practice page) never
// save from a stale wallet.
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

/**
 * Optionally logs today's activity, then claims every reward the records
 * support that isn't in the wallet yet. Safe to call any number of times.
 */
export function claimRewards(
  stores: RewardStores,
  today: LocalDate,
  log?: (activity: Activity) => Activity,
): Promise<ClaimResult> {
  return serialize(async () => {
    let activity = await stores.rewards.getActivity();
    if (log) {
      const logged = log(activity);
      if (logged !== activity) {
        await stores.rewards.saveActivity(logged);
        activity = logged;
      }
    }
    const progresses = await stores.progress.list();
    const before = await stores.rewards.getWallet();
    const claimed = claim(
      before,
      pointRewards(progresses, activity),
      feedRewards(progresses, activity, today),
    );
    const { gained } = claimed;
    const wallet = ensureStarterFish(claimed.wallet, today);
    if (wallet !== before) await stores.rewards.saveWallet(wallet);
    return {
      gained,
      balance: { points: pointBalance(wallet), feed: feedBalance(wallet) },
    };
  });
}

/** After an official task is finished today. */
export const logOfficial = (today: LocalDate) => (activity: Activity) =>
  recordOfficial(activity, today);

/** After a retry of `videoId` is finished today. */
export const logRetry =
  (today: LocalDate, videoId: string) => (activity: Activity) =>
    recordRetry(activity, today, videoId);

/**
 * Applies `change` to the saved wallet (e.g. buying a fish), in the same
 * queue as claims so neither overwrites the other. Saves only real changes.
 */
export function updateWallet(
  rewards: RewardStore,
  change: (wallet: Wallet) => Wallet,
): Promise<Wallet> {
  return serialize(async () => {
    const before = await rewards.getWallet();
    const after = change(before);
    if (after !== before) await rewards.saveWallet(after);
    return after;
  });
}

import { emptyActivity, parseActivity } from "../activity";
import { emptyWallet, parseWallet } from "../wallet";
import type { RewardStore } from "./reward-store";

/** Versioned so a future format change can migrate or ignore old data. */
export const WALLET_KEY = "ll-wallet:v1";
export const ACTIVITY_KEY = "ll-activity:v1";

/**
 * RewardStore backed by Web Storage. Like the progress store, it only touches
 * storage when used, and unreadable data reads as empty.
 */
export function createLocalRewardStore(
  getStorage: () => Storage = () => window.localStorage,
): RewardStore {
  function read<T>(key: string, parse: (data: unknown) => T | null): T | null {
    try {
      const raw = getStorage().getItem(key);
      return raw === null ? null : parse(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  return {
    async getWallet() {
      return read(WALLET_KEY, parseWallet) ?? emptyWallet();
    },
    async saveWallet(wallet) {
      getStorage().setItem(WALLET_KEY, JSON.stringify(wallet));
    },
    async getActivity() {
      return read(ACTIVITY_KEY, parseActivity) ?? emptyActivity();
    },
    async saveActivity(activity) {
      getStorage().setItem(ACTIVITY_KEY, JSON.stringify(activity));
    },
  };
}

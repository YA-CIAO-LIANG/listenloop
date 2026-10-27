"use client";

import { useCallback, useEffect, useState } from "react";
import { updateWallet } from "@/lib/claim-rewards";
import { toLocalDate } from "@/lib/dates";
import { feedFish } from "@/lib/feeding";
import { createLocalRewardStore } from "@/lib/storage/local-reward-store";
import type { RewardStore } from "@/lib/storage/reward-store";
import {
  ensureStarterFish,
  feedBalance,
  pointBalance,
  type Wallet,
} from "@/lib/wallet";
import { REWARDS_EVENT, announceBalance } from "../useRewards";

/** Fired on window after a feeding; detail.point is where (viewport px) or null. */
export const FED_EVENT = "ll:fed";

export type FedDetail = { point: { x: number; y: number } | null };

/**
 * The wallet for the home aquarium (fish in the tank, feed left, days fed),
 * re-read whenever rewards, purchases, or feedings change it.
 */
export function useAquariumWallet(rewards?: RewardStore) {
  const [store] = useState(() => rewards ?? createLocalRewardStore());
  const [wallet, setWallet] = useState<Wallet | null>(null);

  const reload = useCallback(() => {
    updateWallet(store, (w) => ensureStarterFish(w, toLocalDate(new Date())))
      .then(setWallet)
      .catch(() => {});
  }, [store]);

  useEffect(() => {
    reload();
    window.addEventListener(REWARDS_EVENT, reload);
    window.addEventListener(FED_EVENT, reload);
    return () => {
      window.removeEventListener(REWARDS_EVENT, reload);
      window.removeEventListener(FED_EVENT, reload);
    };
  }, [reload]);

  return { wallet, store };
}

/**
 * Uses one portion to feed the fish (point = where the food goes in, or
 * null for the middle of the water). Tells the header and the tank. Returns
 * false when there's no feed (or it can't be saved).
 */
export async function feedAt(
  store: RewardStore,
  point: FedDetail["point"],
): Promise<boolean> {
  let fed = false;
  try {
    const wallet = await updateWallet(store, (w) => {
      const next = feedFish(w, toLocalDate(new Date()));
      fed = next !== null;
      return next ?? w;
    });
    if (!fed) return false;
    announceBalance({
      points: pointBalance(wallet),
      feed: feedBalance(wallet),
    });
    window.dispatchEvent(
      new CustomEvent<FedDetail>(FED_EVENT, { detail: { point } }),
    );
    return true;
  } catch {
    return false;
  }
}

"use client";

import { useCallback, useEffect, useState } from "react";
import type { Activity } from "@/lib/activity";
import {
  claimRewards,
  type ClaimResult,
  type RewardStores,
} from "@/lib/claim-rewards";
import { toLocalDate } from "@/lib/dates";
import { AQUARIUM_ENABLED } from "@/lib/features";
import { createLocalProgressStore } from "@/lib/storage/local-progress-store";
import { createLocalRewardStore } from "@/lib/storage/local-reward-store";

/** Fired on window after every claim; detail is a ClaimResult. */
export const REWARDS_EVENT = "ll:rewards";

/** How long a gain still counts as "just now" for a screen that mounts late. */
const RECENT_MS = 5000;

let lastGain: { result: ClaimResult; at: number } | null = null;

/**
 * Claims new rewards (optionally logging today's activity first) and tells
 * the page. Failures (e.g. blocked storage) are ignored: rewards are a bonus
 * and must never break practice. Missing stores default to localStorage.
 * Does nothing while the aquarium feature is off.
 */
export async function claimAndAnnounce(
  stores: Partial<RewardStores> = {},
  log?: (activity: Activity) => Activity,
): Promise<ClaimResult | null> {
  if (!AQUARIUM_ENABLED) return null;
  try {
    const result = await claimRewards(
      {
        progress: stores.progress ?? createLocalProgressStore(),
        rewards: stores.rewards ?? createLocalRewardStore(),
      },
      toLocalDate(new Date()),
      log,
    );
    if (result.gained.points > 0 || result.gained.feed > 0) {
      lastGain = { result, at: Date.now() };
    }
    window.dispatchEvent(new CustomEvent(REWARDS_EVENT, { detail: result }));
    return result;
  } catch {
    return null;
  }
}

/** Tells the page about new balances without new rewards (e.g. after buying). */
export function announceBalance(balance: ClaimResult["balance"]) {
  window.dispatchEvent(
    new CustomEvent(REWARDS_EVENT, {
      detail: { gained: { points: 0, feed: 0 }, balance },
    }),
  );
}

/** Calls `listener` with every claim result while mounted. */
export function useRewardEvents(listener: (result: ClaimResult) => void) {
  useEffect(() => {
    function onRewards(event: Event) {
      listener((event as CustomEvent<ClaimResult>).detail);
    }
    window.addEventListener(REWARDS_EVENT, onRewards);
    return () => window.removeEventListener(REWARDS_EVENT, onRewards);
  }, [listener]);
}

/**
 * What the latest claim just gave (points and feed), for completion screens:
 * a gain from the last few seconds counts even if it came before mounting.
 */
export function useLatestGain() {
  const [gain, setGain] = useState(() =>
    lastGain && Date.now() - lastGain.at < RECENT_MS
      ? lastGain.result.gained
      : null,
  );
  useRewardEvents(
    useCallback((result: ClaimResult) => {
      if (result.gained.points > 0 || result.gained.feed > 0) {
        setGain(result.gained);
      }
    }, []),
  );
  return gain;
}

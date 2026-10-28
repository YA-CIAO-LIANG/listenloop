"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import type { ClaimResult, RewardStores } from "@/lib/claim-rewards";
import { AQUARIUM_ENABLED } from "@/lib/features";
import type { Gained } from "@/lib/wallet";
import { FeedIcon, PointsIcon } from "./icons";
import { claimAndAnnounce, useLatestGain, useRewardEvents } from "./useRewards";

/** How long "+N" stays next to a balance. */
export const GAIN_VISIBLE_MS = 2000;

/** "12 points · 1 portion of feed", leaving out whatever is zero. */
function useGainText() {
  const t = useTranslations("rewards");
  return (gained: Gained) =>
    [
      gained.points > 0 ? t("pointsPart", { n: gained.points }) : null,
      gained.feed > 0 ? t("feedPart", { n: gained.feed }) : null,
    ]
      .filter(Boolean)
      .join(" · ");
}

type RewardBadgeProps = {
  /** Injected in tests; defaults to localStorage. */
  stores?: Partial<RewardStores>;
};

/**
 * Header balances: points (for fish) and feed (for feeding). Claims any
 * rewards not yet given on mount (including past practice), and shows a
 * short "+N" whenever new rewards arrive. Links to the fish shop. Hidden
 * until loaded, so the server HTML always matches.
 */
export function RewardBadge({ stores }: RewardBadgeProps) {
  const t = useTranslations("rewards");
  const gainText = useGainText();
  const [balance, setBalance] = useState<ClaimResult["balance"] | null>(null);
  const [gain, setGain] = useState<Gained | null>(null);

  useRewardEvents(
    useCallback((result: ClaimResult) => {
      setBalance(result.balance);
      if (result.gained.points > 0 || result.gained.feed > 0) {
        setGain(result.gained);
      }
    }, []),
  );

  useEffect(() => {
    void claimAndAnnounce(stores);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- claim once on mount
  }, []);

  useEffect(() => {
    if (!gain) return;
    const timer = window.setTimeout(() => setGain(null), GAIN_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [gain]);

  if (!balance) return null;

  const plus = (amount: number | undefined) =>
    amount ? (
      <span className="animate-gain text-accent-ink motion-reduce:animate-none">
        +{amount}
      </span>
    ) : null;

  return (
    <div className="flex items-center text-supporting tabular-nums">
      <Link
        href="/shop"
        className="flex items-center gap-3 rounded-base px-1 hover:text-accent-ink"
      >
        <span className="sr-only">{t("badgeLink", balance)}</span>
        <span aria-hidden="true" className="flex items-center gap-1">
          <PointsIcon className="size-4 text-accent-ink" />
          <span className="hidden text-ink-muted split:inline">
            {t("points")}
          </span>
          {balance.points}
          {plus(gain?.points)}
        </span>
        <span aria-hidden="true" className="flex items-center gap-1">
          <FeedIcon className="size-4 text-accent-ink" />
          <span className="hidden text-ink-muted split:inline">
            {t("feed")}
          </span>
          {balance.feed}
          {plus(gain?.feed)}
        </span>
      </Link>
      <span className="sr-only" aria-live="polite">
        {gain ? t("gained", { items: gainText(gain) }) : ""}
      </span>
    </div>
  );
}

/**
 * "Earned 12 points · 1 portion of feed" on a completion screen, shown only
 * when this visit actually earned something.
 */
export function RewardGainedNote() {
  return AQUARIUM_ENABLED ? <GainedNote /> : null;
}

function GainedNote() {
  const t = useTranslations("rewards");
  const gainText = useGainText();
  const gain = useLatestGain();
  if (!gain) return null;
  return (
    <p className="text-supporting text-accent-ink">
      {t("gained", { items: gainText(gain) })}
    </p>
  );
}

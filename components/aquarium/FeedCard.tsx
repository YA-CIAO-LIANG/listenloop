"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toLocalDate } from "@/lib/dates";
import { fedDates, isHungry } from "@/lib/feeding";
import type { RewardStore } from "@/lib/storage/reward-store";
import { feedBalance } from "@/lib/wallet";
import { Button } from "../Button";
import { Card } from "../Card";
import { FeedIcon } from "../icons";
import { feedAt, useAquariumWallet } from "./useAquariumWallet";

type FeedCardProps = {
  /** Injected in tests; defaults to localStorage. */
  rewards?: RewardStore;
};

/**
 * Feed on the home page: portions left, a "Feed the fish" button (the same
 * as tapping the water, for keyboards and screen readers), one gentle line
 * about the fish (fed today, hungry, or how to get feed), and a link to the
 * shop and My fish.
 */
export function FeedCard({ rewards }: FeedCardProps) {
  const t = useTranslations("aquarium");
  const { wallet, store } = useAquariumWallet(rewards);
  const [announce, setAnnounce] = useState("");
  const today = toLocalDate(new Date());
  const portions = wallet ? feedBalance(wallet) : 0;
  const fedToday = wallet ? fedDates(wallet).includes(today) : false;
  const hungry = wallet ? isHungry(wallet, today) : false;

  async function feed() {
    if (await feedAt(store, null)) {
      setAnnounce(t("fed", { count: Math.max(0, portions - 1) }));
    }
  }

  const status = fedToday
    ? null
    : portions === 0
      ? t("noFeed")
      : hungry
        ? t("hungry")
        : t("tapHint");

  return (
    <Card data-solid className="flex flex-col gap-4">
      <h2 className="font-display text-h3">{t("feedTitle")}</h2>
      <p className="flex items-center gap-2 tabular-nums">
        <FeedIcon className="size-4 text-accent-ink" />
        {t("portions", { count: portions })}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          disabled={!wallet || portions === 0}
          onClick={() => void feed()}
        >
          {t("feed")}
        </Button>
        {fedToday && (
          <span className="text-supporting text-success">
            <span aria-hidden="true">✓ </span>
            {t("fedToday")}
          </span>
        )}
      </div>
      {status && <p className="text-supporting text-ink-muted">{status}</p>}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <p className="mt-auto text-supporting">
        <Link
          href="/shop"
          className="text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
        >
          {t("shopLink")}
          <span aria-hidden="true"> →</span>
        </Link>
      </p>
    </Card>
  );
}

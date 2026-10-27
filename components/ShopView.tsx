"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { updateWallet } from "@/lib/claim-rewards";
import { toLocalDate } from "@/lib/dates";
import type { Fish } from "@/lib/fish";
import { createLocalRewardStore } from "@/lib/storage/local-reward-store";
import type { RewardStore } from "@/lib/storage/reward-store";
import {
  TANK_CAPACITY,
  buyFish,
  ensureStarterFish,
  feedBalance,
  fishOf,
  pointBalance,
  setInTank,
  type Wallet,
} from "@/lib/wallet";
import { Button } from "./Button";
import { Card } from "./Card";
import { FishThumbnail } from "./FishThumbnail";
import { announceBalance } from "./useRewards";

type ShopViewProps = {
  catalog: readonly Fish[];
  /** Injected in tests; defaults to localStorage. */
  rewards?: RewardStore;
};

/**
 * The fish shop and "My fish". Buying asks once more (points are never
 * refunded); a new fish joins the aquarium if there's room. My fish chooses
 * which fish (up to TANK_CAPACITY) swim on the home page.
 */
export function ShopView({ catalog, rewards }: ShopViewProps) {
  const t = useTranslations("shop");
  const tFish = useTranslations("fish");
  const [store] = useState(() => rewards ?? createLocalRewardStore());
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);

  const name = (species: string) => tFish(`${species}.name` as "snail.name");

  useEffect(() => {
    updateWallet(store, (w) => ensureStarterFish(w, toLocalDate(new Date())))
      .then(setWallet)
      .catch(() => setSaveFailed(true));
  }, [store]);

  async function change(next: (w: Wallet) => Wallet) {
    try {
      const updated = await updateWallet(store, next);
      setWallet(updated);
      setSaveFailed(false);
      announceBalance({
        points: pointBalance(updated),
        feed: feedBalance(updated),
      });
      return updated;
    } catch {
      setSaveFailed(true);
      return null;
    }
  }

  async function buy(fish: Fish) {
    setConfirming(null);
    let bought = false;
    const updated = await change((w) => {
      const next = buyFish(w, fish.id, fish.price, toLocalDate(new Date()));
      bought = next !== null;
      return next ?? w;
    });
    if (!updated || !bought) return;
    const newest = fishOf(updated).owned.at(-1);
    const swimming = newest && fishOf(updated).inTank.includes(newest.id);
    setMessage(
      swimming
        ? t("bought", { name: name(fish.id) })
        : t("boughtTankFull", { name: name(fish.id), max: TANK_CAPACITY }),
    );
  }

  if (!wallet) {
    return (
      <p role="status" className="text-ink-muted">
        {t("loading")}
      </p>
    );
  }

  const points = pointBalance(wallet);
  const { owned, inTank } = fishOf(wallet);
  const tankFull = inTank.length >= TANK_CAPACITY;

  return (
    <div className="space-y-16">
      <section className="space-y-6">
        <p className="font-display text-h3">{t("balance", { points })}</p>
        <p aria-live="polite" className="text-supporting text-success">
          {message}
        </p>
        {saveFailed && (
          <p role="alert" className="text-supporting text-error">
            {t("saveFailed")}
          </p>
        )}
        <ul className="grid gap-6 split:grid-cols-2">
          {catalog.map((fish) => {
            const short = fish.price - points;
            return (
              <li key={fish.id}>
                <Card className="flex h-full flex-col gap-4">
                  <FishThumbnail fish={fish} />
                  <div className="space-y-1">
                    <h2 className="font-display text-h3">{name(fish.id)}</h2>
                    <p className="text-supporting text-ink-muted">
                      {tFish(`${fish.id}.blurb` as "snail.blurb")}
                    </p>
                  </div>
                  <p className="tabular-nums">
                    {t("price", { price: fish.price })}
                  </p>
                  <div className="mt-auto flex flex-wrap items-center gap-3">
                    {confirming === fish.id ? (
                      <>
                        <p className="w-full text-supporting">
                          {t("confirm", {
                            price: fish.price,
                            name: name(fish.id),
                          })}
                        </p>
                        <Button
                          variant="primary"
                          onClick={() => void buy(fish)}
                        >
                          {t("confirmYes")}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setConfirming(null)}
                        >
                          {t("cancel")}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="secondary"
                          disabled={short > 0}
                          onClick={() => {
                            setMessage("");
                            setConfirming(fish.id);
                          }}
                        >
                          {t("buy")}
                        </Button>
                        {short > 0 && (
                          <span className="text-supporting text-ink-muted">
                            {t("notEnough", { n: short })}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <section id="my-fish" className="space-y-4">
        <h2 className="font-display text-h2">{t("myFish")}</h2>
        <p className="tabular-nums">
          {t("tank", { count: inTank.length, max: TANK_CAPACITY })}
        </p>
        <p className="text-supporting text-ink-muted">
          {t("tankHint", { max: TANK_CAPACITY })}
        </p>
        <ul className="border-t border-line">
          {owned.map((fish) => {
            const swimming = inTank.includes(fish.id);
            const [, number] = fish.id.split(":");
            return (
              <li
                key={fish.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3"
              >
                <span>
                  {number === "starter"
                    ? `${name(fish.species)} · ${t("starter")}`
                    : t("fishLabel", { name: name(fish.species), n: number })}
                </span>
                <label className="flex items-center gap-2 text-supporting">
                  <input
                    type="checkbox"
                    checked={swimming}
                    disabled={!swimming && tankFull}
                    onChange={(event) => {
                      // Read now: the controlled box resets before the save runs.
                      const checked = event.target.checked;
                      void change((w) => setInTank(w, fish.id, checked));
                    }}
                    className="size-4 accent-(--ll-accent)"
                  />
                  {!swimming && tankFull ? t("tankFull") : t("inTank")}
                </label>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

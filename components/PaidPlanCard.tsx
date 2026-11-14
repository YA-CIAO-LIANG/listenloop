"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  joinWaitlist as joinWaitlistAction,
  type WaitlistResult,
} from "@/app/plans/actions";
import { PLANS, type PlanBlock } from "@/lib/plans";
import { Button } from "./Button";
import { PLAN_PRICES } from "@/lib/payments/pricing";
import type { PlanPrices } from "@/lib/price-experiments";
import { PlanPrice } from "./PlanPrice";

/**
 * What the paid plan will include, for an account past its free trial
 * (D72): the numbers come from PLANS, the price says "coming soon", and
 * one button joins the waiting list (kept in the database).
 */
export function PaidPlanCard({
  block,
  joined: joinedBefore,
  prices = PLAN_PRICES,
  joinWaitlist = joinWaitlistAction,
}: {
  /** Why creating is blocked, for the first line. */
  block: PlanBlock;
  joined: boolean;
  /** The prices this account sees (D174, auth/prices.ts). */
  prices?: PlanPrices;
  /** Injected in tests; the Server Action otherwise. */
  joinWaitlist?: typeof joinWaitlistAction;
}) {
  const t = useTranslations("plans");
  const [joined, setJoined] = useState(joinedBefore);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const paid = PLANS.paid;

  async function join() {
    setPending(true);
    setFailed(false);
    // The plan and price shown here (Plus yearly), remembered with the
    // list for the early-bird offer (D174).
    const result = await joinWaitlist({
      plan: "plus",
      period: "year",
      source: "trial-used",
    }).catch((): WaitlistResult => ({
      ok: false,
      reason: "failed",
    }));
    setPending(false);
    if (result.ok) setJoined(true);
    else setFailed(true);
  }

  return (
    <section
      aria-labelledby="paid-plan"
      className="max-w-practice space-y-4 rounded-base border border-line surface-card p-6"
    >
      <p className="text-ink-muted">
        {t(`limits.${block.limit}`, { max: block.max ?? 0 })}
      </p>
      <h2 id="paid-plan" className="font-display text-h2">
        {t("paid.title")}
      </h2>
      <ul className="space-y-1">
        {paid.minutesPerMonth !== null && (
          <li>
            <span aria-hidden="true" className="text-success">
              ✓{" "}
            </span>
            {t("paid.perMonth", { max: paid.minutesPerMonth })}
          </li>
        )}
        {paid.maxPracticeSeconds !== null && (
          <li>
            <span aria-hidden="true" className="text-success">
              ✓{" "}
            </span>
            {t("paid.longest", { max: paid.maxPracticeSeconds / 60 })}
          </li>
        )}
        <li>
          <span aria-hidden="true" className="text-success">
            ✓{" "}
          </span>
          {t("paid.everything")}
        </li>
      </ul>
      {/* Plus billed yearly, a month first like everywhere (D128). */}
      <PlanPrice total={prices.plus.year.amount} period="year" size="md" />
      <div aria-live="polite" className="space-y-2">
        {joined ? (
          <p className="text-success">
            <span aria-hidden="true">✓ </span>
            {t("paid.joined")}
          </p>
        ) : (
          <Button variant="primary" disabled={pending} onClick={join}>
            {t("paid.join")}
          </Button>
        )}
        {failed && (
          <p role="alert" className="text-supporting text-error">
            {t("paid.failed")}
          </p>
        )}
      </div>
      <p className="text-supporting text-ink-muted">{t("paid.free")}</p>
    </section>
  );
}

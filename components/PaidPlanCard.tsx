"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  joinWaitlist as joinWaitlistAction,
  type WaitlistResult,
} from "@/app/plans/actions";
import { planLabel, type PlanNameTranslator } from "@/lib/plan-names";
import {
  accountPlanFor,
  PLANS,
  type PlanBlock,
  type PlanId,
} from "@/lib/plans";
import { listeningOffer } from "@/lib/pricing-display";
import { secondsToWords } from "@/lib/units";
import { Button } from "./Button";
import { PLAN_PRICES } from "@/lib/payments/pricing";
import type { PlanPrices } from "@/lib/price-experiments";
import { PlanPrice } from "./PlanPrice";
import { UpsellToAll } from "./UpsellToAll";

/**
 * What a plan with more listening includes (D72, D210), for an account
 * past its allowance: the plan to offer comes from `listeningOffer` (an
 * upgrade to all-in-one on the writing line), the numbers from PLANS,
 * the price says "coming soon", and one button joins the waiting list.
 */
export function PaidPlanCard({
  block,
  plan,
  joined: joinedBefore,
  prices = PLAN_PRICES,
  joinWaitlist = joinWaitlistAction,
}: {
  /** Why creating is blocked, for the first line. */
  block: PlanBlock;
  /** The account's plan, to choose what to offer. */
  plan: PlanId;
  joined: boolean;
  /** The prices this account sees (D174, auth/prices.ts). */
  prices?: PlanPrices;
  /** Injected in tests; the Server Action otherwise. */
  joinWaitlist?: typeof joinWaitlistAction;
}) {
  const t = useTranslations("plans");
  const tn = useTranslations("planNames") as unknown as PlanNameTranslator;
  const [joined, setJoined] = useState(joinedBefore);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const offer = listeningOffer(plan);
  const limits = offer ? PLANS[accountPlanFor(offer.line, offer.tier)] : null;

  async function join() {
    if (!offer) return;
    setPending(true);
    setFailed(false);
    // The plan and price shown here (yearly), remembered with the list
    // for the early-bird offer (D174).
    const result = await joinWaitlist({
      line: offer.line,
      plan: offer.tier,
      period: "year",
      source: offer.upsell ? "upsell-all" : "trial-used",
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
      <UpsellToAll need="listening" feature="create-words" />
      {offer && limits && (
        <>
          <h2 id="paid-plan" className="font-display text-h2">
            {planLabel(accountPlanFor(offer.line, offer.tier), tn)}
          </h2>
          <ul className="space-y-1">
            {limits.wordsPerMonth !== null && (
              <li>
                <span aria-hidden="true" className="text-success">
                  ✓{" "}
                </span>
                {t("paid.perMonth", { max: limits.wordsPerMonth })}
              </li>
            )}
            {limits.maxPracticeSeconds !== null && (
              <li>
                <span aria-hidden="true" className="text-success">
                  ✓{" "}
                </span>
                {t("paid.longest", {
                  words: secondsToWords(limits.maxPracticeSeconds),
                })}
              </li>
            )}
            <li>
              <span aria-hidden="true" className="text-success">
                ✓{" "}
              </span>
              {t("paid.everything")}
            </li>
          </ul>
          {/* Billed yearly, a month first like everywhere (D128). */}
          <PlanPrice
            total={prices[offer.line][offer.tier].year.amount}
            period="year"
            size="md"
          />
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
        </>
      )}
      {plan === "free" && (
        <p className="text-supporting text-ink-muted">
          {t("paid.free", { words: PLANS.free.wordsPerWeek ?? 0 })}
        </p>
      )}
    </section>
  );
}

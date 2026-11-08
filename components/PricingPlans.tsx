"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { startCheckout } from "@/app/billing/actions";
import {
  joinWaitlist as joinWaitlistAction,
  type WaitlistResult,
} from "@/app/plans/actions";
import {
  PRICES,
  REFUND_DAYS,
  yearlyPerMonth,
  yearlySaving,
  type BillingInterval,
} from "@/lib/payments/pricing";
import { PLANS } from "@/lib/plans";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";
import { SegmentedControl } from "./SegmentedControl";
import { Tag } from "./Tag";

const linkClassName =
  "text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink";

/**
 * The free and paid plans side by side (D85), with a monthly / yearly
 * choice. Prices and what's included come from lib/payments/pricing.ts
 * and PLANS. While payments are off, the paid plan says "coming soon"
 * and offers the waiting list instead of a checkout.
 */
export function PricingPlans({
  payments,
  signedIn,
  paid,
  joined: joinedBefore,
  joinWaitlist = joinWaitlistAction,
}: {
  /** Off: "coming soon"; test: the fake provider's checkout. */
  payments: "off" | "test" | "live";
  signedIn: boolean;
  /** The account is already on the paid plan. */
  paid: boolean;
  joined: boolean;
  joinWaitlist?: () => Promise<WaitlistResult>;
}) {
  const t = useTranslations("pricing");
  const tPlans = useTranslations("plans");
  const [interval, setInterval] = useState<BillingInterval>("year");
  const [joined, setJoined] = useState(joinedBefore);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const limits = PLANS.paid;

  async function join() {
    setPending(true);
    setFailed(false);
    const result = await joinWaitlist().catch((): WaitlistResult => ({
      ok: false,
      reason: "failed",
    }));
    setPending(false);
    if (result.ok) setJoined(true);
    else setFailed(true);
  }

  const features = {
    free: [t("free.features.f1"), t("free.features.f2"), t("free.features.f3")],
    paid: [
      t("paid.features.f1"),
      t("paid.features.f2", { max: limits.practicesPerMonth ?? 0 }),
      t("paid.features.f3", { chars: limits.charsPerPractice ?? 0 }),
    ],
  };
  const checklist = (items: string[]) => (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item}>
          <span aria-hidden="true" className="text-success">
            ✓{" "}
          </span>
          {item}
        </li>
      ))}
    </ul>
  );

  const paidAction = (() => {
    if (paid) {
      return (
        <div className="space-y-2">
          <p className="text-success">{t("paid.current")}</p>
          <ButtonLink href="/account#billing">{t("paid.manage")}</ButtonLink>
        </div>
      );
    }
    if (payments === "off") {
      if (!signedIn) return null;
      return (
        <div aria-live="polite" className="space-y-2">
          {joined ? (
            <p className="text-success">
              <span aria-hidden="true">✓ </span>
              {tPlans("paid.joined")}
            </p>
          ) : (
            <Button variant="primary" disabled={pending} onClick={join}>
              {tPlans("paid.join")}
            </Button>
          )}
          {failed && (
            <p role="alert" className="text-supporting text-error">
              {tPlans("paid.failed")}
            </p>
          )}
        </div>
      );
    }
    if (!signedIn) {
      return <p className="text-ink-muted">{t("paid.signIn")}</p>;
    }
    return (
      <form action={startCheckout}>
        <input type="hidden" name="interval" value={interval} />
        <Button type="submit" variant="primary">
          {interval === "month"
            ? t("paid.subscribeMonth", { amount: PRICES.month.amount })
            : t("paid.subscribeYear", { amount: PRICES.year.amount })}
        </Button>
      </form>
    );
  })();

  return (
    <div className="space-y-8">
      {payments === "test" && (
        <p
          role="note"
          className="rounded-base border border-line bg-surface px-4 py-3 text-supporting"
        >
          {t("testMode")}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          legend={t("intervalLabel")}
          value={interval}
          options={[
            { value: "month", label: t("monthly") },
            { value: "year", label: t("yearly") },
          ]}
          onChange={setInterval}
          optionWidthClassName="min-w-16"
        />
        <Tag>{t("yearlySave", { percent: yearlySaving() })}</Tag>
      </div>
      <div className="grid gap-6 split:grid-cols-2">
        <section
          aria-labelledby="plan-free"
          className="space-y-4 rounded-base border border-line bg-surface p-6"
        >
          <h2 id="plan-free" className="font-display text-h2">
            {t("free.title")}
          </h2>
          <p className="font-display text-h3">{t("free.price")}</p>
          {checklist(features.free)}
        </section>
        <section
          aria-labelledby="plan-paid"
          className="space-y-4 rounded-base border border-accent bg-surface p-6"
        >
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="plan-paid" className="font-display text-h2">
              {t("paid.title")}
            </h2>
            {payments === "off" && <Tag>{t("comingSoon")}</Tag>}
          </div>
          <div>
            <p className="font-display text-h3">
              {interval === "month"
                ? t("paid.perMonth", { amount: PRICES.month.amount })
                : t("paid.perYear", { amount: PRICES.year.amount })}
            </p>
            {interval === "year" && (
              <p className="mt-1 text-supporting text-ink-muted">
                {t("paid.yearlyNote", { amount: yearlyPerMonth() })}
              </p>
            )}
          </div>
          {checklist(features.paid)}
          {paidAction}
        </section>
      </div>
      <ul className="max-w-reading list-disc space-y-2 pl-5 text-supporting text-ink-muted">
        <li>{t("notes.renew")}</li>
        <li>{t("notes.refund", { days: REFUND_DAYS })}</li>
      </ul>
      <p className="text-supporting text-ink-muted">
        <Link href="/refund" className={linkClassName}>
          {t("refundLink")}
        </Link>
        {" · "}
        <Link href="/terms" className={linkClassName}>
          {t("termsLink")}
        </Link>
      </p>
    </div>
  );
}

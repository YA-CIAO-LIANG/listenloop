"use client";

import { ScrollRegion } from "./ScrollRegion";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { recordIntent } from "@/app/intent-actions";
import {
  joinWaitlist as joinWaitlistAction,
  type WaitlistResult,
} from "@/app/plans/actions";
import type { IntentSource } from "@/lib/intent";
import {
  averagePerMonth,
  BILLING_PERIODS,
  DEFAULT_PERIOD,
  formatPrice,
  PAID_PLANS,
  PLAN_PRICES,
  REFUND_DAYS,
  YEARLY_MONTHS_FREE,
  type BillingPeriod,
  type PaidPlan,
} from "@/lib/payments/pricing";
import { PLANS } from "@/lib/plans";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";
import { Dialog } from "./Dialog";
import { SegmentedControl } from "./SegmentedControl";
import { Tag } from "./Tag";

const linkClassName =
  "text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink";

/** The account plan behind each paid plan ("paid" is Plus, D102). */
const LIMITS = { plus: PLANS.paid, pro: PLANS.pro } as const;

/** The comparison table's rows: what each plan has (D102). */
const FEATURES = [
  "official",
  "create",
  "longest",
  "youtube",
  "speed",
  "stats",
  "rules",
  "priority",
  "batchPdf",
] as const;

/**
 * Plans and pricing (D102, D105): Free, Plus, and Pro, billed monthly or
 * yearly (the default). A yearly price is 10 × the monthly one, shown
 * with "2 months free" and its average a month, never as a percentage.
 * Paying isn't open yet: "Subscribe" says so and offers the waiting list
 * (a fake door). Every step is recorded (intent_events) for the admin's
 * interest page.
 */
export function PricingPlans({
  signedIn,
  current,
  joined: joinedBefore,
  source,
  open: openAtStart = null,
  joinWaitlist = joinWaitlistAction,
  record = recordIntent,
}: {
  signedIn: boolean;
  /** The account's plan, to mark it. */
  current: "free" | PaidPlan | null;
  joined: boolean;
  /** Where the visitor came from (?from=). */
  source: IntentSource;
  /** Back from signing in to join: the plan and period they chose. */
  open?: { plan: PaidPlan; period: BillingPeriod } | null;
  /** Injected in tests; the Server Actions otherwise. */
  joinWaitlist?: typeof joinWaitlistAction;
  record?: typeof recordIntent;
}) {
  const t = useTranslations("plansPage");
  const format = useFormatter();
  const [period, setPeriod] = useState<BillingPeriod>(
    openAtStart?.period ?? DEFAULT_PERIOD,
  );
  const [offer, setOffer] = useState<PaidPlan | null>(
    openAtStart?.plan ?? null,
  );
  const [joined, setJoined] = useState(joinedBefore);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const viewed = useRef(false);
  const price = (amount: number) =>
    formatPrice(amount, "TWD", (value) => format.number(value));

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    void record({ step: "pricing_view", source });
  }, [record, source]);

  function choosePeriod(next: BillingPeriod) {
    setPeriod(next);
    void record({ step: "interval_switch", interval: next, source });
  }

  function subscribe(plan: PaidPlan) {
    setOffer(plan);
    setFailed(false);
    void record({ step: "subscribe_click", plan, interval: period, source });
  }

  async function join(plan: PaidPlan) {
    setPending(true);
    setFailed(false);
    const result = await joinWaitlist({ plan, period, source }).catch(
      (): WaitlistResult => ({ ok: false, reason: "failed" }),
    );
    setPending(false);
    if (result.ok) setJoined(true);
    else setFailed(true);
  }

  const cell = (
    plan: "free" | PaidPlan,
    feature: (typeof FEATURES)[number],
  ): string => {
    const limits = plan === "free" ? PLANS.free : LIMITS[plan];
    const yes = t("yes");
    const no = t("no");
    switch (feature) {
      case "official":
        return yes;
      case "create":
        return limits.practicesTotal !== null
          ? t("trial", { n: limits.practicesTotal })
          : t("perMonth", { n: limits.minutesPerMonth ?? 0 });
      case "longest": {
        const seconds = limits.maxPracticeSeconds;
        if (seconds === null) return t("noLimit");
        return seconds < 60
          ? t("seconds", { n: seconds })
          : t("minutes", { n: seconds / 60 });
      }
      case "youtube":
        return limits.youtubePractices ? yes : no;
      case "speed":
        return limits.playbackSpeed ? yes : no;
      case "stats":
        return limits.fullStats ? t("statsFull") : t("statsBasic");
      case "rules":
        return limits.customRules ? yes : no;
      case "priority":
        return limits.priority ? yes : no;
      case "batchPdf":
        return limits.batchPdf ? t("soon") : no;
    }
  };

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <p aria-hidden="true" className="font-medium">
          {t("periodLegend")}
        </p>
        <SegmentedControl
          legend={t("periodLegend")}
          value={period}
          options={BILLING_PERIODS.map((value) => ({
            value,
            label:
              value === "year"
                ? `${t("periods.year")} · ${t("monthsFree", { months: YEARLY_MONTHS_FREE })}`
                : t(`periods.${value}`),
          }))}
          onChange={choosePeriod}
          optionWidthClassName="min-w-20"
        />
        <p className="text-supporting text-ink-muted">{t("monthlyReset")}</p>
      </div>

      <ul className="grid gap-6 wide:grid-cols-3">
        <li className="space-y-4 rounded-base border border-line bg-surface p-6">
          <h2 className="flex flex-wrap items-center gap-2 font-display text-h3">
            {t("names.free")}
            {current === "free" && <Tag>{t("current")}</Tag>}
          </h2>
          <p className="font-display text-h2 tabular-nums">{price(0)}</p>
          <p className="text-supporting">{t("summaries.free")}</p>
        </li>
        {PAID_PLANS.map((plan) => {
          const total = PLAN_PRICES[plan][period].amount;
          return (
            <li
              key={plan}
              className={`space-y-4 rounded-base border bg-surface p-6 ${
                plan === "plus" ? "border-accent" : "border-line"
              }`}
            >
              <h2 className="flex flex-wrap items-center gap-2 font-display text-h3">
                {t(`names.${plan}`)}
                {current === plan && <Tag>{t("current")}</Tag>}
              </h2>
              <p>
                <span className="font-display text-h2 tabular-nums">
                  {price(total)}
                </span>
                <span className="text-ink-muted">
                  {" "}
                  {period === "year" ? t("perYearSuffix") : t("perMonthSuffix")}
                </span>
              </p>
              {period === "year" && (
                <p className="text-supporting tabular-nums">
                  <span className="text-success">
                    {t("monthsFree", { months: YEARLY_MONTHS_FREE })}
                  </span>
                  <span className="text-ink-muted">
                    {" · "}
                    {t("averagePerMonth", {
                      amount: price(averagePerMonth(total)),
                    })}
                  </span>
                </p>
              )}
              <p className="text-supporting">{t(`summaries.${plan}`)}</p>
              <Button
                variant={plan === "plus" ? "primary" : "secondary"}
                onClick={() => subscribe(plan)}
              >
                {t("subscribe", { plan: t(`names.${plan}`) })}
              </Button>
            </li>
          );
        })}
      </ul>

      <ScrollRegion label={t("compareTitle")}>
        <table className="w-full min-w-120 text-left text-supporting">
          <caption className="mb-3 text-left font-display text-h3">
            {t("compareTitle")}
          </caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-2 pr-4 font-normal text-ink-muted">
                {t("feature")}
              </th>
              {(["free", ...PAID_PLANS] as const).map((plan) => (
                <th key={plan} scope="col" className="px-2 py-2 font-medium">
                  {t(`names.${plan}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((feature) => (
              <tr key={feature} className="border-b border-line">
                <th scope="row" className="py-2 pr-4 font-normal">
                  {t(`features.${feature}`)}
                </th>
                {(["free", ...PAID_PLANS] as const).map((plan) => (
                  <td key={plan} className="px-2 py-2">
                    {cell(plan, feature)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>

      <div className="space-y-2 text-supporting text-ink-muted">
        <p>
          {t("refund", { days: REFUND_DAYS })}{" "}
          <Link href="/refund" className={linkClassName}>
            {t("refundLink")}
          </Link>
        </p>
      </div>

      {offer && (
        <Dialog
          title={t("offerTitle", {
            plan: t(`names.${offer}`),
            period: t(`periods.${period}`),
          })}
          onClose={() => setOffer(null)}
        >
          <p>{t("comingSoon")}</p>
          {joined ? (
            <p role="status" className="text-success">
              <span aria-hidden="true">✓ </span>
              {t("joined")}
            </p>
          ) : signedIn ? (
            <Button
              variant="primary"
              onClick={() => join(offer)}
              disabled={pending}
            >
              {pending ? t("joining") : t("join")}
            </Button>
          ) : (
            <ButtonLink
              variant="primary"
              href={`/login?next=${encodeURIComponent(
                `/pricing?plan=${offer}&period=${period}&from=${source}`,
              )}`}
            >
              {t("signInToJoin")}
            </ButtonLink>
          )}
          {failed && (
            <p role="alert" className="text-supporting text-error">
              {t("joinFailed")}
            </p>
          )}
          <Button variant="ghost" onClick={() => setOffer(null)}>
            {t("close")}
          </Button>
        </Dialog>
      )}
    </div>
  );
}

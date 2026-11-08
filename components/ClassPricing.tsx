"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { recordIntent } from "@/app/intent-actions";
import { CLASS_PLAN, classPrice } from "@/lib/classroom";
import type { IntentSource } from "@/lib/intent";
import {
  averagePerMonth,
  BILLING_PERIODS,
  DEFAULT_PERIOD,
  formatPrice,
  YEARLY_MONTHS_FREE,
  type BillingPeriod,
} from "@/lib/payments/pricing";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { SegmentedControl } from "./SegmentedControl";

/**
 * The class plan (D103, D105): one plan, billed monthly or yearly (the
 * default, 10 × monthly: "2 months free"), with the waiting list's
 * priority price beside it. Subscribing is a fake door like the personal
 * plans (D102); every step is recorded.
 */
export function ClassPricing({
  source,
  record = recordIntent,
}: {
  source: IntentSource;
  record?: typeof recordIntent;
}) {
  const t = useTranslations("classPricing");
  const tPlans = useTranslations("plansPage");
  const format = useFormatter();
  const [period, setPeriod] = useState<BillingPeriod>(DEFAULT_PERIOD);
  const [offer, setOffer] = useState(false);
  const viewed = useRef(false);
  const heading = useId();
  const price = (amount: number) =>
    formatPrice(amount, "TWD", (value) => format.number(value));
  const suffix =
    period === "year" ? tPlans("perYearSuffix") : tPlans("perMonthSuffix");
  const full = classPrice(period);
  const priority = classPrice(period, { priority: true });

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    void record({ step: "pricing_view", item: "classroom", source });
  }, [record, source]);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p aria-hidden="true" className="font-medium">
          {tPlans("periodLegend")}
        </p>
        <SegmentedControl
          legend={tPlans("periodLegend")}
          value={period}
          options={BILLING_PERIODS.map((value) => ({
            value,
            label:
              value === "year"
                ? `${tPlans("periods.year")} · ${tPlans("monthsFree", { months: YEARLY_MONTHS_FREE })}`
                : tPlans(`periods.${value}`),
          }))}
          onChange={(next) => {
            setPeriod(next);
            void record({
              step: "interval_switch",
              interval: next,
              item: "classroom",
              source,
            });
          }}
          optionWidthClassName="min-w-20"
        />
      </div>

      <section
        aria-labelledby={heading}
        className="max-w-reading space-y-4 rounded-base border border-accent bg-surface p-6"
      >
        <h2 id={heading} className="font-display text-h3">
          {t("planName")}
        </h2>
        <p>
          <span className="font-display text-h2 tabular-nums">
            {price(full)}
          </span>
          <span className="text-ink-muted"> {suffix}</span>
        </p>
        {period === "year" && (
          <p className="text-supporting tabular-nums">
            <span className="text-success">
              {tPlans("monthsFree", { months: YEARLY_MONTHS_FREE })}
            </span>
            <span className="text-ink-muted">
              {" · "}
              {tPlans("averagePerMonth", {
                amount: price(averagePerMonth(full)),
              })}
            </span>
          </p>
        )}
        <div className="space-y-1 border-t border-line pt-4">
          <p className="font-medium">{t("priority")}</p>
          <p className="tabular-nums">
            <span className="font-display text-h3">{price(priority)}</span>
            <span className="text-ink-muted"> {suffix}</span>
            {period === "year" && (
              <span className="text-supporting text-ink-muted">
                {" · "}
                {tPlans("averagePerMonth", {
                  amount: price(averagePerMonth(priority)),
                })}
              </span>
            )}
          </p>
          <p className="text-supporting text-ink-muted">{t("priorityNote")}</p>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-supporting">
          <li>{t("seats", { seats: CLASS_PLAN.seats })}</li>
          <li>{t("minutes", { minutes: CLASS_PLAN.minutes })}</li>
          <li>{t("features")}</li>
        </ul>
        <Button
          variant="primary"
          onClick={() => {
            setOffer(true);
            void record({
              step: "subscribe_click",
              plan: "class",
              interval: period,
              source,
            });
          }}
        >
          {t("subscribe")}
        </Button>
      </section>
      <p className="text-supporting text-ink-muted">{t("note")}</p>

      {offer && (
        <Dialog
          title={t("offerTitle", { period: tPlans(`periods.${period}`) })}
          onClose={() => setOffer(false)}
        >
          <p>{t("comingSoon")}</p>
          <Button
            variant="primary"
            onClick={() => {
              void record({
                step: "waitlist_join",
                plan: "class",
                interval: period,
                source,
              });
              setOffer(false);
            }}
          >
            {t("notify")}
          </Button>
        </Dialog>
      )}
    </div>
  );
}

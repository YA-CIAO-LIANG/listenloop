"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { recordIntent } from "@/app/intent-actions";
import {
  CLASS_PERIOD_LENGTH,
  CLASS_TIERS,
  classPrice,
  classSaving,
  type ClassSeats,
} from "@/lib/classroom";
import type { IntentSource } from "@/lib/intent";
import {
  BEST_VALUE_PERIOD,
  BILLING_PERIODS,
  DEFAULT_PERIOD,
  formatPrice,
  type BillingPeriod,
} from "@/lib/payments/pricing";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { SegmentedControl } from "./SegmentedControl";

/**
 * Class plans (D103): by students, billed monthly, yearly (9 months'
 * price, the default), or every two years (16 months'). Subscribing is a
 * fake door like the personal plans (D102); every step is recorded.
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
  const [offer, setOffer] = useState<ClassSeats | null>(null);
  const viewed = useRef(false);
  const price = (amount: number) =>
    formatPrice(amount, "TWD", (value) => format.number(value));

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
              value === DEFAULT_PERIOD
                ? `${tPlans(`periods.${value}`)} · ${tPlans("popular")}`
                : value === BEST_VALUE_PERIOD
                  ? `${tPlans(`periods.${value}`)} · ${tPlans("bestValue")}`
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
        {period !== "month" && (
          <p className="text-supporting text-success">
            {t("periodSaving", {
              months: CLASS_PERIOD_LENGTH[period],
              paid: period === "year" ? 9 : 16,
              percent: classSaving(period),
            })}
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-120 text-left text-supporting tabular-nums">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-2 pr-4 font-normal text-ink-muted">
                {t("students")}
              </th>
              <th scope="col" className="px-2 py-2 font-normal text-ink-muted">
                {t("perMonth")}
              </th>
              <th scope="col" className="px-2 py-2 font-normal text-ink-muted">
                {t("total")}
              </th>
              <th scope="col" className="px-2 py-2 font-normal text-ink-muted">
                {t("teacherMinutes")}
              </th>
              <th scope="col" className="px-2 py-2">
                <span className="sr-only">{t("subscribeColumn")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {CLASS_TIERS.map((tier) => {
              const total = classPrice(tier.seats, period);
              return (
                <tr key={tier.seats} className="border-b border-line">
                  <th scope="row" className="py-2 pr-4 font-medium">
                    {t("seats", { seats: tier.seats })}
                  </th>
                  <td className="px-2 py-2">
                    {price(Math.round(total / CLASS_PERIOD_LENGTH[period]))}
                  </td>
                  <td className="px-2 py-2">{price(total)}</td>
                  <td className="px-2 py-2">
                    {t("minutes", { minutes: tier.minutes })}
                  </td>
                  <td className="px-2 py-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setOffer(tier.seats);
                        void record({
                          step: "subscribe_click",
                          plan: `class-${tier.seats}`,
                          interval: period,
                          source,
                        });
                      }}
                    >
                      {t("subscribe")}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-supporting text-ink-muted">{t("note")}</p>

      {offer && (
        <Dialog
          title={t("offerTitle", {
            seats: offer,
            period: tPlans(`periods.${period}`),
          })}
          onClose={() => setOffer(null)}
        >
          <p>{t("comingSoon")}</p>
          <Button
            variant="primary"
            onClick={() => {
              void record({
                step: "waitlist_join",
                plan: `class-${offer}`,
                interval: period,
                source,
              });
              setOffer(null);
            }}
          >
            {t("notify")}
          </Button>
        </Dialog>
      )}
    </div>
  );
}

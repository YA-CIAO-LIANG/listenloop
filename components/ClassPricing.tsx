"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { recordIntent } from "@/app/intent-actions";
import { CLASS_TIERS, classPrice } from "@/lib/classroom";
import {
  PLAN_LINES,
  lineHasListening,
  lineHasWriting,
  type PlanLine,
} from "@/lib/plans";
import { shortTexts } from "@/lib/pricing-display";
import type { IntentSource } from "@/lib/intent";
import {
  BILLING_PERIODS,
  DEFAULT_LINE,
  DEFAULT_PERIOD,
  YEARLY_MONTHS_FREE,
  type BillingPeriod,
} from "@/lib/payments/pricing";
import { Button } from "./Button";
import { PlanPrice } from "./PlanPrice";
import { Dialog } from "./Dialog";
import { SegmentedControl } from "./SegmentedControl";

/**
 * Class plans (D173, D210): three sizes, each as listening (the teacher's
 * own words a month), writing (each student's AI a week), or both
 * ("all", the default), billed monthly or yearly (the default, 10 ×
 * monthly). Subscribing is a fake door like the personal plans (D102);
 * every step is recorded.
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
  const tn = useTranslations("planNames");
  const [line, setLine] = useState<PlanLine>(DEFAULT_LINE);
  const [period, setPeriod] = useState<BillingPeriod>(DEFAULT_PERIOD);
  const [offer, setOffer] = useState<(typeof CLASS_TIERS)[number] | null>(null);
  const viewed = useRef(false);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    void record({ step: "pricing_view", item: "classroom", source });
  }, [record, source]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <div className="space-y-2">
          <p aria-hidden="true" className="font-medium">
            {tPlans("lineLegend")}
          </p>
          <SegmentedControl
            legend={tPlans("lineLegend")}
            value={line}
            options={PLAN_LINES.map((value) => ({
              value,
              label: tn(`lines.${value}`),
            }))}
            onChange={setLine}
            optionWidthClassName="min-w-20"
          />
        </div>
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
      </div>

      <ul className="grid gap-6 wide:grid-cols-3">
        {CLASS_TIERS.map((tier) => (
          <li
            key={tier.id}
            className={`space-y-4 rounded-base border bg-surface p-6 ${
              tier.id === "standard" ? "border-accent" : "border-line"
            }`}
          >
            <h2 className="font-display text-h3">
              {t("name", {
                tier: t(`tiers.${tier.id}`),
                line: tn(`lines.${line}`),
              })}
            </h2>
            {/* The price a month is always the big number (D128). */}
            <PlanPrice total={classPrice(tier, period, line)} period={period} />
            <ul className="list-disc space-y-1 pl-5 text-supporting">
              <li>{t("seats", { seats: tier.seats })}</li>
              {lineHasListening(line) && (
                <li>
                  {t("words", {
                    words: tier.words,
                    texts: shortTexts(tier.words),
                  })}
                </li>
              )}
              {lineHasWriting(line) && (
                <li>
                  {tier.perStudent.chatMessagesPerWeek > 0
                    ? t("writingWithChat", {
                        essays: tier.perStudent.essaysPerWeek,
                        sets: tier.perStudent.backChecksPerWeek,
                        messages: tier.perStudent.chatMessagesPerWeek,
                      })
                    : t("writing", {
                        essays: tier.perStudent.essaysPerWeek,
                        sets: tier.perStudent.backChecksPerWeek,
                      })}
                </li>
              )}
            </ul>
            <Button
              variant={tier.id === "standard" ? "primary" : "secondary"}
              onClick={() => {
                setOffer(tier);
                void record({
                  step: "subscribe_click",
                  plan: `class-${tier.id}-${line}`,
                  interval: period,
                  source,
                });
              }}
            >
              {t("subscribe", { tier: t(`tiers.${tier.id}`) })}
            </Button>
          </li>
        ))}
      </ul>
      <p className="max-w-reading text-supporting">{t("features")}</p>
      <p className="max-w-reading text-supporting">{t("lines")}</p>
      <p className="text-supporting text-ink-muted">{t("note")}</p>

      {offer && (
        <Dialog
          title={t("offerTitle", {
            tier: t("name", {
              tier: t(`tiers.${offer.id}`),
              line: tn(`lines.${line}`),
            }),
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
                plan: `class-${offer.id}-${line}`,
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

"use client";

import { ScrollRegion } from "./ScrollRegion";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import {
  forecast,
  FORECAST_PLANS,
  type ForecastInput,
  type ForecastPlan,
} from "@/lib/forecast";
import { BILLING_PERIODS, type BillingPeriod } from "@/lib/payments/pricing";
import { StatTile } from "./StatTile";

const inputClassName =
  "h-10 w-24 rounded-base border border-line bg-surface px-2 text-right tabular-nums focus-visible:border-accent pointer-coarse:min-h-11";

/**
 * The revenue forecast (D102): every number editable, the month's
 * result recomputed as you type. Nothing is saved.
 */
export function ForecastCalculator({ initial }: { initial: ForecastInput }) {
  const t = useTranslations("admin.forecast");
  const format = useFormatter();
  const [input, setInput] = useState(initial);
  const result = forecast(input);
  const nt = (n: number) => `NT$${format.number(Math.round(n))}`;
  const num = (value: string) =>
    Number.isFinite(Number(value)) ? Number(value) : 0;

  const setGrid = (
    key: "subscribers" | "prices",
    plan: ForecastPlan,
    period: BillingPeriod,
    value: string,
  ) =>
    setInput((current) => ({
      ...current,
      [key]: {
        ...current[key],
        [plan]: { ...current[key][plan], [period]: num(value) },
      },
    }));

  return (
    <div className="space-y-10">
      <dl className="grid grid-cols-2 gap-4 wide:grid-cols-4">
        <StatTile
          label={t("revenue")}
          value={nt(result.revenue)}
          note={t("perMonth")}
        />
        <StatTile
          label={t("cash")}
          value={nt(result.cash)}
          note={t("cashNote")}
        />
        <StatTile
          label={t("grossMargin")}
          value={format.number(result.grossMargin, {
            style: "percent",
            maximumFractionDigits: 1,
          })}
          note={t("costs", { ai: nt(result.aiCost), fees: nt(result.fees) })}
        />
        <StatTile
          label={t("net")}
          value={nt(result.net)}
          note={t("server", { server: nt(result.serverCost) })}
        />
      </dl>

      <ScrollRegion label={t("plansTitle")}>
        <table className="w-full min-w-120 text-left text-supporting">
          <caption className="mb-3 text-left font-display text-h3">
            {t("plansTitle")}
          </caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-2 pr-4 font-normal text-ink-muted">
                {t("plan")}
              </th>
              {BILLING_PERIODS.map((period) => (
                <th key={period} scope="col" className="px-2 py-2 font-medium">
                  {t(`periods.${period}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FORECAST_PLANS.flatMap((plan) =>
              (["subscribers", "prices"] as const).map((key) => (
                <tr key={`${plan}-${key}`} className="border-b border-line">
                  <th scope="row" className="py-2 pr-4 font-normal">
                    {t(`rows.${key}`, { plan: t(`names.${plan}`) })}
                  </th>
                  {BILLING_PERIODS.map((period) => (
                    <td key={period} className="px-2 py-2">
                      <input
                        type="number"
                        min={0}
                        aria-label={`${t(`rows.${key}`, { plan: t(`names.${plan}`) })} · ${t(`periods.${period}`)}`}
                        value={input[key][plan][period]}
                        onChange={(event) =>
                          setGrid(key, plan, period, event.target.value)
                        }
                        className={inputClassName}
                      />
                    </td>
                  ))}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </ScrollRegion>

      <fieldset className="grid gap-4 split:grid-cols-2 wide:grid-cols-3">
        <legend className="mb-3 font-display text-h3">
          {t("assumptions")}
        </legend>
        {FORECAST_PLANS.map((plan) => (
          <label key={plan} className="space-y-1">
            <span className="block">
              {t("usage", { plan: t(`names.${plan}`) })}
            </span>
            <input
              type="number"
              min={0}
              max={100}
              value={Math.round(input.usage[plan] * 100)}
              onChange={(event) =>
                setInput((c) => ({
                  ...c,
                  usage: { ...c.usage, [plan]: num(event.target.value) / 100 },
                }))
              }
              className={inputClassName}
            />
          </label>
        ))}
        {(
          [
            ["aiPerMinute", 100, 1],
            ["feeRate", 100, 0.1],
            ["feeFixed", 1, 1],
            ["serverMonthly", 1, 100],
          ] as const
        ).map(([key, scale, step]) => (
          <label key={key} className="space-y-1">
            <span className="block">{t(`fields.${key}`)}</span>
            <input
              type="number"
              min={0}
              step={step}
              value={
                key === "aiPerMinute"
                  ? input[key]
                  : Math.round(input[key] * scale * 100) / 100
              }
              onChange={(event) =>
                setInput((c) => ({
                  ...c,
                  [key]: num(event.target.value) / scale,
                }))
              }
              className={inputClassName}
            />
          </label>
        ))}
      </fieldset>
      <p className="max-w-reading text-supporting text-ink-muted">
        {t("notes")}
      </p>
    </div>
  );
}

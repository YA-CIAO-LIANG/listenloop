"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  clearPriceOverride,
  endPriceExperiment,
  startPriceExperiment,
  type ExperimentResult,
} from "@/app/admin/price-experiments/actions";
import { PAID_PLANS, type PaidPlan } from "@/lib/payments/pricing";
import { EXPERIMENT_LIMITS, type Variant } from "@/lib/price-experiments";
import { Button } from "./Button";

const fieldClassName =
  "h-10 rounded-base border border-line bg-surface px-2 focus-visible:border-accent pointer-coarse:min-h-11";

function useOutcome() {
  const t = useTranslations("admin.priceExperiments");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(action: () => Promise<ExperimentResult>) {
    setPending(true);
    setError(null);
    const result = await action().catch((): ExperimentResult => ({
      ok: false,
      reason: "failed",
    }));
    setPending(false);
    if (result.ok) router.refresh();
    else
      setError(
        result.reason === "belowFloor"
          ? t("errors.belowFloor", { min: result.min })
          : t(`errors.${result.reason}`),
      );
  }
  const message = error && (
    <p role="alert" className="text-supporting text-error">
      {error}
    </p>
  );
  return { pending, run, message };
}

/** Starts an experiment: a plan and 2–4 monthly prices (D174). */
export function StartExperimentForm({
  current,
  names,
}: {
  /** Each plan's monthly price now, the first variant by default. */
  current: Record<PaidPlan, number>;
  /** Each plan's name, from the server (the admin area's messages). */
  names: Record<PaidPlan, string>;
}) {
  const t = useTranslations("admin.priceExperiments");
  const { pending, run, message } = useOutcome();
  const [plan, setPlan] = useState<PaidPlan>("plus");
  const [prices, setPrices] = useState<string[]>([
    String(current.plus),
    "",
    "",
  ]);
  const id = useId();
  return (
    <form
      className="max-w-reading space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void run(() =>
          startPriceExperiment({
            plan,
            prices: prices.filter((p) => p.trim() !== ""),
          }),
        );
      }}
    >
      <div className="space-y-1">
        <label htmlFor={`${id}-plan`} className="block">
          {t("plan")}
        </label>
        <select
          id={`${id}-plan`}
          value={plan}
          onChange={(event) => {
            const next = event.target.value as PaidPlan;
            setPlan(next);
            setPrices((p) => [String(current[next]), ...p.slice(1)]);
          }}
          className={fieldClassName}
        >
          {PAID_PLANS.map((p) => (
            <option key={p} value={p}>
              {names[p]}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="space-y-2">
        <legend>{t("prices")}</legend>
        <p className="text-supporting text-ink-muted">{t("pricesHint")}</p>
        {prices.map((value, i) => (
          <label key={i} className="flex items-center gap-2">
            <span className="w-28">
              {i === 0 ? t("control") : t("variant", { n: i + 1 })}
            </span>
            <span aria-hidden="true" className="text-ink-muted">
              NT$
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={EXPERIMENT_LIMITS.minMonthly}
              max={EXPERIMENT_LIMITS.maxMonthly}
              value={value}
              onChange={(event) =>
                setPrices((p) =>
                  p.map((v, j) => (j === i ? event.target.value : v)),
                )
              }
              className={`${fieldClassName} w-28 text-right tabular-nums`}
            />
          </label>
        ))}
        {prices.length < EXPERIMENT_LIMITS.maxVariants && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPrices((p) => [...p, ""])}
          >
            {t("addVariant")}
          </Button>
        )}
      </fieldset>
      <Button type="submit" variant="primary" disabled={pending}>
        {t("start")}
      </Button>
      {message}
    </form>
  );
}

/** Ends the running experiment, applying one price or none. */
export function EndExperimentForm({
  id,
  variants,
  suggested,
}: {
  id: string;
  variants: readonly Variant[];
  suggested: string | null;
}) {
  const t = useTranslations("admin.priceExperiments");
  const { pending, run, message } = useOutcome();
  const [choice, setChoice] = useState<string>(suggested ?? "none");
  const field = useId();
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!window.confirm(t("endConfirm"))) return;
        void run(() =>
          endPriceExperiment({ id, apply: choice === "none" ? null : choice }),
        );
      }}
    >
      <div className="space-y-1">
        <label htmlFor={field} className="block">
          {t("apply")}
        </label>
        <select
          id={field}
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
          className={fieldClassName}
        >
          {variants.map((v) => (
            <option key={v.key} value={v.key}>
              {t("applyPrice", { price: v.monthly })}
              {v.key === suggested ? ` · ${t("suggested")}` : ""}
            </option>
          ))}
          <option value="none">{t("applyNone")}</option>
        </select>
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        {t("end")}
      </Button>
      {message}
    </form>
  );
}

/** Takes an applied price back to the code's default. */
export function ClearOverrideButton({ plan }: { plan: PaidPlan }) {
  const t = useTranslations("admin.priceExperiments");
  const { pending, run, message } = useOutcome();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => void run(() => clearPriceOverride({ plan }))}
      >
        {t("clear")}
      </Button>
      {message}
    </span>
  );
}

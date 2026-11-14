"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import {
  submitPriceSurvey,
  type PriceSurveyResult,
} from "@/app/price-survey-actions";
import {
  cleanPriceAnswers,
  PRICE_SURVEY,
  PRICE_SURVEY_QUESTIONS,
  type PriceQuestion,
  type PriceSurveyContext,
} from "@/lib/price-survey";
import { Button } from "./Button";

/** This device already answered or skipped it: "answered" | "skipped". */
export const PRICE_SURVEY_STORAGE_KEY = "ll-price-survey:v1";

function readSeen(): boolean {
  try {
    return window.localStorage.getItem(PRICE_SURVEY_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

function markSeen(value: "answered" | "skipped") {
  try {
    window.localStorage.setItem(PRICE_SURVEY_STORAGE_KEY, value);
  } catch {
    // Storage blocked: it may be offered again next time.
  }
}

const noSubscribe = () => () => {};

const inputClassName =
  "h-11 w-32 rounded-base border border-line bg-surface px-3 text-right tabular-nums focus-visible:border-accent";

/**
 * The price sensitivity survey (Van Westendorp, D174): four prices a
 * month for Plus. Offered once per device, after Day 7 or after
 * PRICE_SURVEY.pricingDwellSeconds on the pricing page; skippable, and
 * never asked again once answered or skipped.
 */
export function PriceSurvey({
  context,
  submit = submitPriceSurvey,
}: {
  context: PriceSurveyContext;
  /** Injected in tests; the Server Action otherwise. */
  submit?: typeof submitPriceSurvey;
}) {
  const t = useTranslations("priceSurvey");
  const seen = useSyncExternalStore(noSubscribe, readSeen, () => true);
  // On the pricing page it waits until the visitor has looked a while.
  const [ready, setReady] = useState(context !== "pricing");
  const [values, setValues] = useState<Record<PriceQuestion, string>>({
    tooExpensive: "",
    expensive: "",
    bargain: "",
    tooCheap: "",
  });
  const [invalid, setInvalid] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<PriceSurveyResult | null>(null);
  const [skipped, setSkipped] = useState(false);
  const ids = {
    heading: useId(),
    hint: useId(),
    error: useId(),
    field: useId(),
  };

  useEffect(() => {
    if (context !== "pricing") return;
    const timer = window.setTimeout(
      () => setReady(true),
      PRICE_SURVEY.pricingDwellSeconds * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [context]);

  if (result?.ok) {
    return (
      <p role="status" className="text-success">
        <span aria-hidden="true">✓ </span>
        {t("thanks")}
      </p>
    );
  }
  if (seen || skipped || !ready) return null;

  async function send() {
    const answers = cleanPriceAnswers(values);
    if (!answers) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setPending(true);
    const outcome = await submit({ answers, context }).catch(
      (): PriceSurveyResult => ({ ok: false, reason: "failed" }),
    );
    setPending(false);
    setResult(outcome);
    if (outcome.ok) markSeen("answered");
  }

  return (
    <section
      aria-labelledby={ids.heading}
      className="max-w-reading space-y-4 rounded-base border border-line surface-card p-6"
    >
      <h2 id={ids.heading} className="font-display text-h3">
        {t("title")}
      </h2>
      <p id={ids.hint} className="text-supporting text-ink-muted">
        {t("intro")}
      </p>
      <form
        className="space-y-4"
        aria-describedby={ids.hint}
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        {PRICE_SURVEY_QUESTIONS.map((question) => (
          <div key={question} className="space-y-1">
            <label htmlFor={`${ids.field}-${question}`} className="block">
              {t(`questions.${question}`)}
            </label>
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="text-ink-muted">
                NT$
              </span>
              <input
                id={`${ids.field}-${question}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={PRICE_SURVEY.max}
                step={1}
                required
                value={values[question]}
                aria-invalid={invalid || undefined}
                aria-describedby={invalid ? ids.error : undefined}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [question]: event.target.value,
                  }))
                }
                className={inputClassName}
              />
              <span className="text-supporting text-ink-muted">
                {t("perMonth")}
              </span>
            </div>
          </div>
        ))}
        {invalid && (
          <p id={ids.error} role="alert" className="text-supporting text-error">
            {t("order")}
          </p>
        )}
        {result?.ok === false && (
          <p role="alert" className="text-supporting text-error">
            {t("failed")}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? t("sending") : t("send")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              markSeen("skipped");
              setSkipped(true);
            }}
          >
            {t("skip")}
          </Button>
        </div>
      </form>
    </section>
  );
}

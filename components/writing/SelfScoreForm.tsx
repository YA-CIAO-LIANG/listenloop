"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { percentScore, RUBRICS } from "@/lib/writing/rubrics";
import type { SelfScore } from "@/lib/writing/progress";
import {
  ERROR_TYPES,
  type ErrorType,
  type RubricId,
} from "@/lib/writing/types";
import { Button } from "../Button";

/** At most this many things to work on (deliberate practice, D187). */
const MAX_WEAK = 3;

/**
 * Scoring one's own essay against the rubric (D187): for guests, and when
 * the AI can't review. Each criterion on its own scale, then up to three
 * kinds of mistakes to work on, which plan the days 2–6 like AI feedback.
 */
export function SelfScoreForm({
  rubric,
  onDone,
  onCancel,
}: {
  rubric: RubricId;
  onDone: (self: SelfScore) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("writing");
  const r = RUBRICS[rubric];
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(r.criteria.map((c) => [c.id, Math.ceil(c.max / 2)])),
  );
  const [weak, setWeak] = useState<ErrorType[]>([]);

  const criteria = r.criteria.map((c) => ({ id: c.id, score: scores[c.id] }));
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        onDone({ criteria, percent: percentScore(r, criteria), weak });
      }}
    >
      <h2 className="font-display text-h3">{t("self.heading")}</h2>
      <p className="max-w-reading text-supporting text-ink-muted">
        {t("self.intro")}
      </p>
      {r.criteria.map((c) => {
        const steps = Array.from(
          { length: Math.round(c.max / c.step) + 1 },
          (_, i) => i * c.step,
        );
        return (
          <label key={c.id} className="flex flex-col gap-1 split:max-w-sm">
            <span className="font-medium">{t(`criteria.${c.id}`)}</span>
            <select
              value={scores[c.id]}
              onChange={(e) =>
                setScores({ ...scores, [c.id]: Number(e.target.value) })
              }
              className="min-h-10 rounded-base border border-line bg-surface px-3 pointer-coarse:min-h-11"
            >
              {steps.map((value) => (
                <option key={value} value={value}>
                  {t("self.option", { score: value, max: c.max })}
                </option>
              ))}
            </select>
          </label>
        );
      })}
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">
          {t("self.weak", { max: MAX_WEAK })}
        </legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {ERROR_TYPES.map((type) => {
            const on = weak.includes(type);
            return (
              <label
                key={type}
                className="inline-flex min-h-8 items-center gap-2 text-supporting pointer-coarse:min-h-11"
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={!on && weak.length >= MAX_WEAK}
                  onChange={() =>
                    setWeak(
                      on ? weak.filter((w) => w !== type) : [...weak, type],
                    )
                  }
                  className="size-4"
                />
                {t(`errors.${type}`)}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary">
          {t("self.submit")}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("self.back")}
        </Button>
      </div>
    </form>
  );
}

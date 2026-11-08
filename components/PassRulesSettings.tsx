"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { can } from "@/lib/plans";
import {
  DAY7_SCORE_OPTIONS,
  DEFAULT_PASS_RULES,
  DICTATION_MIN_OPTIONS,
  passRulesOf,
  sameRules,
  SHADOWING_MIN_OPTIONS,
  type PassRules,
} from "@/lib/pass-rules";
import type { Progress } from "@/lib/progress";
import type { ProgressStore } from "@/lib/storage/progress-store";
import { usePlan } from "./PlanProvider";
import { useVideoProgress } from "./useVideoProgress";

// Full width of its column, so a long option never pushes past the screen.
const selectClassName =
  "h-10 w-full min-w-0 rounded-base border border-line bg-surface px-2 text-body focus-visible:border-accent disabled:opacity-60 pointer-coarse:min-h-11";

/**
 * A practice's pass rules (D92): the lowest dictation accuracy that
 * finishes Day 1 and Day 7, the coverage that counts a shadowed sentence,
 * and what passes the week. Saved in the practice's progress, so it syncs
 * like the rest; changes apply to the days not yet finished. Paid plans
 * only (lib/plans.ts); others see the defaults and where to get it.
 */
export function PassRulesSettings({
  videoId,
  store,
}: {
  videoId: string;
  /** Injected in tests; the stores otherwise. */
  store?: ProgressStore;
}) {
  const t = useTranslations("passRules");
  const format = useFormatter();
  const plan = usePlan();
  const {
    progress,
    loaded,
    store: progressStore,
  } = useVideoProgress(videoId, store);
  const [saved, setSaved] = useState<Progress | null>(null);
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");
  const id = useId();
  const current = saved ?? progress;
  const rules = passRulesOf(current);
  const allowed = can(plan, { kind: "custom-rules" }).ok;
  const editable = allowed && current !== null;
  const percent = (value: number) =>
    format.number(value, { style: "percent", maximumFractionDigits: 0 });

  async function change(next: PassRules) {
    if (!current) return;
    const { rules: _old, ...rest } = current;
    void _old;
    const updated: Progress = sameRules(next, DEFAULT_PASS_RULES)
      ? rest
      : { ...rest, rules: next };
    try {
      await progressStore.save(updated);
      setSaved(updated);
      setStatus("saved");
    } catch {
      setStatus("failed");
    }
  }

  if (!loaded) return null;

  return (
    <section
      id="pass-rules"
      aria-labelledby={`${id}-title`}
      className="scroll-mt-16 space-y-4"
    >
      <h2 id={`${id}-title`} className="font-display text-h3">
        {t("title")}
      </h2>
      <p className="max-w-reading text-supporting text-ink-muted">
        {t("intro")}
      </p>

      <div className="grid gap-4 split:grid-cols-3">
        <label className="min-w-0 space-y-1">
          <span className="block text-supporting">{t("dictationMin")}</span>
          <select
            className={selectClassName}
            disabled={!editable}
            value={rules.dictationMin}
            onChange={(event) =>
              change({ ...rules, dictationMin: Number(event.target.value) })
            }
          >
            {DICTATION_MIN_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value === 0 ? t("anyScore") : percent(value)}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0 space-y-1">
          <span className="block text-supporting">{t("shadowingMin")}</span>
          <select
            className={selectClassName}
            disabled={!editable}
            value={rules.shadowingMin}
            onChange={(event) =>
              change({ ...rules, shadowingMin: Number(event.target.value) })
            }
          >
            {SHADOWING_MIN_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {percent(value)}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0 space-y-1">
          <span className="block text-supporting">{t("day7")}</span>
          <select
            className={selectClassName}
            disabled={!editable}
            value={rules.day7.kind === "score" ? rules.day7.min : "improve"}
            onChange={(event) => {
              const value = event.target.value;
              change({
                ...rules,
                day7:
                  value === "improve"
                    ? { kind: "improve" }
                    : { kind: "score", min: Number(value) },
              });
            }}
          >
            <option value="improve">{t("improve")}</option>
            {DAY7_SCORE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t("reach", { score: percent(value) })}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p role="status" className="text-supporting text-ink-muted">
        {!allowed ? (
          <>
            {t("paidOnly")}{" "}
            <Link
              href="/pricing?from=custom-rules"
              className="text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
            >
              {t("seePlans")}
            </Link>
          </>
        ) : !current ? (
          t("startFirst")
        ) : status === "saved" ? (
          t("saved")
        ) : status === "failed" ? (
          <span className="text-error">{t("failed")}</span>
        ) : null}
      </p>
    </section>
  );
}

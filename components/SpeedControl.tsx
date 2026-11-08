"use client";

import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { can } from "@/lib/plans";
import { SPEED_WEIGHTS, SPEEDS, type Speed } from "@/lib/speed";
import { usePlan } from "./PlanProvider";
import { SegmentedControl } from "./SegmentedControl";

/**
 * Playback speed for audio practices (D73): 0.75×, 1×, 1.25×, same pitch.
 * Videos don't get it (YouTube plays at 1×). Below, how much an answer at
 * each speed counts, so the weighted score is no surprise.
 */
export function SpeedControl({
  value,
  onChange,
  showWeights = true,
}: {
  value: Speed;
  onChange: (speed: Speed) => void;
  /** Dictation only: shadowing has no score to weight. */
  showWeights?: boolean;
}) {
  const t = useTranslations("speed");
  const format = useFormatter();
  // Plus and Pro (D102); the free plan sees what it is (a fake door).
  if (!can(usePlan(), { kind: "feature", feature: "playbackSpeed" }).ok) {
    return (
      <p className="text-supporting text-ink-muted">
        {t("locked")}{" "}
        <Link
          href="/pricing?from=speed"
          className="text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
        >
          {t("seePlans")}
        </Link>
      </p>
    );
  }
  const percent = (n: number) =>
    format.number(n, { style: "percent", maximumFractionDigits: 0 });
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span aria-hidden="true" className="text-supporting text-ink-muted">
        {t("label")}
      </span>
      <SegmentedControl
        legend={t("label")}
        value={String(value)}
        options={SPEEDS.map((speed) => ({
          value: String(speed),
          label: t("option", { speed }),
        }))}
        onChange={(next) => onChange(Number(next) as Speed)}
        optionWidthClassName="min-w-14"
      />
      {showWeights && (
        <span className="text-metadata text-ink-muted">
          {t("weights", {
            slow: percent(SPEED_WEIGHTS["0.75"]),
            fast: percent(SPEED_WEIGHTS["1.25"]),
          })}
        </span>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { recordIntent } from "@/app/intent-actions";
import { planParts, type PlanLine } from "@/lib/plans";
import { usePlan } from "./PlanProvider";

/** The part a line lacks: what someone on it would need "all" for. */
const LACKS: Readonly<
  Record<Exclude<PlanLine, "all">, "listening" | "writing">
> = {
  listening: "writing",
  writing: "listening",
};

/**
 * "Upgrade to All-in-One" (D210): shown where someone on the listening
 * line reaches a writing limit or feature, or someone on the writing
 * line a listening one. Nothing for anyone else (free, "all", admins).
 * Seeing it is recorded once (upsell_view, with the feature as its item)
 * for the admin's interest page.
 */
export function UpsellToAll({
  need,
  feature,
  record = recordIntent,
}: {
  /** The part the blocked step belongs to. */
  need: "listening" | "writing";
  /** What prompted it, for the funnel (≤ 32 characters). */
  feature: string;
  record?: typeof recordIntent;
}) {
  const t = useTranslations("upsellAll");
  const parts = planParts(usePlan());
  const shown =
    parts !== null && parts.line !== "all" && LACKS[parts.line] === need;
  const recorded = useRef(false);
  useEffect(() => {
    if (!shown || recorded.current) return;
    recorded.current = true;
    void record({
      step: "upsell_view",
      plan: `all-${parts.tier}`,
      item: feature,
      source: "upsell-all",
    });
  }, [shown, parts, feature, record]);
  if (!shown) return null;
  return (
    <p
      data-testid="upsell-all"
      className="rounded-base border border-accent surface-card p-4 text-supporting"
    >
      {t(need)}{" "}
      <Link
        href={`/pricing?line=all&from=upsell-all`}
        className="text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
      >
        {t("link")}
      </Link>
    </p>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { PerfectBurst } from "./PerfectBurst";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/**
 * What a 100% sentence gets, in dictation and shadowing alike (D52): the
 * confetti burst, or with reduced motion a static "Perfect!". Put it
 * inside the result's text; the burst fills the nearest positioned
 * ancestor. Remount it (a new `key`) to play it again.
 */
export function PerfectCelebration() {
  const t = useTranslations("celebration");
  const reduceMotion = usePrefersReducedMotion();
  return reduceMotion ? (
    <span className="ml-2 font-medium text-accent-ink">{t("perfect")}</span>
  ) : (
    <PerfectBurst />
  );
}

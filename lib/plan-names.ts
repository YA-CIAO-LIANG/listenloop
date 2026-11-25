import { planParts, type PlanId } from "./plans";

/**
 * A plan's name for people (D210): "Plus・聽寫全方位", "學生・聽力",
 * from the planNames messages, so every page names plans the same way.
 */
export type PlanNameTranslator = (
  key: string,
  values?: Record<string, string>,
) => string;

export function planLabel(plan: PlanId, t: PlanNameTranslator): string {
  const parts = planParts(plan);
  if (!parts) return t(plan === "admin" ? "admin" : "free");
  return t("format", {
    tier: t(`tiers.${parts.tier}`),
    line: t(`lines.${parts.line}`),
  });
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ForecastCalculator } from "@/components/ForecastCalculator";
import { defaultForecastInput } from "@/lib/forecast";
import {
  listeningCostPerMinute,
  TWD_PER_USD,
  UNIT_COSTS,
} from "@/lib/payments/costs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.forecast");
  return { title: t("title") };
}

/**
 * The revenue forecast (D102, D210): editable subscribers, prices, usage,
 * and a cost factor, with a month's revenue, cash up front, gross margin,
 * and net; and each plan's AI and voice cost at full and typical use,
 * from the calibrated unit costs (lib/payments/costs.ts).
 */
export default async function AdminForecastPage() {
  const t = await getTranslations("admin.forecast");
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">
        {t("intro", {
          perMinute: round(listeningCostPerMinute()),
          essay: round(UNIT_COSTS.essay),
          check: round(UNIT_COSTS.backCheck),
          message: round(UNIT_COSTS.chatMessage),
          rate: TWD_PER_USD,
        })}
      </p>
      <div className="mt-8">
        <ForecastCalculator initial={defaultForecastInput()} />
      </div>
    </main>
  );
}

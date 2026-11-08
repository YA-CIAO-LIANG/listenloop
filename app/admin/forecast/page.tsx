import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAdminSupabase } from "@/auth/admin";
import { ForecastCalculator } from "@/components/ForecastCalculator";
import { defaultForecastInput } from "@/lib/forecast";
import { usagePeriodStarts } from "@/lib/usage-report";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.forecast");
  return { title: t("title") };
}

/** US$ to NT$ for the defaults (Nov 2026, rounded). */
const TWD_PER_USD = 32;
/**
 * AI cost per minute of practice when there's nothing to measure yet:
 * the official batch of 2026-11-08 (D99) cost about US$0.018 a minute.
 */
const FALLBACK_USD_PER_MINUTE = 0.018;

/**
 * The revenue forecast (D102): editable subscribers, prices, usage, and
 * costs, with a month's revenue, cash up front, gross margin, and net.
 * The AI cost per minute starts from this month's real spend on created
 * practices (api_calls ÷ their minutes), else last night's batch.
 */
export default async function AdminForecastPage() {
  const t = await getTranslations("admin.forecast");
  const admin = getAdminSupabase();
  let usdPerMinute = FALLBACK_USD_PER_MINUTE;
  let measured = false;
  if (admin) {
    const { monthStart } = usagePeriodStarts(new Date());
    const [{ data: calls }, { data: practices }] = await Promise.all([
      admin
        .from("api_calls")
        .select("cost_micros")
        .gte("created_at", monthStart),
      admin
        .from("practices")
        .select("estimated_seconds")
        .gte("created_at", monthStart)
        .not("estimated_seconds", "is", null),
    ]);
    const cost =
      (calls ?? []).reduce((s, c) => s + (c.cost_micros ?? 0), 0) / 1e6;
    const minutes =
      (practices ?? []).reduce((s, p) => s + (p.estimated_seconds ?? 0), 0) /
      60;
    if (minutes >= 10 && cost > 0) {
      usdPerMinute = cost / minutes;
      measured = true;
    }
  }
  const aiPerMinute = Math.round(usdPerMinute * TWD_PER_USD * 100) / 100;
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">
        {t(measured ? "introMeasured" : "introFallback", {
          perMinute: aiPerMinute,
          rate: TWD_PER_USD,
        })}
      </p>
      <div className="mt-8">
        <ForecastCalculator initial={defaultForecastInput(aiPerMinute)} />
      </div>
    </main>
  );
}

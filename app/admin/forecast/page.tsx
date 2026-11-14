import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAdminSupabase } from "@/auth/admin";
import { ForecastCalculator } from "@/components/ForecastCalculator";
import {
  defaultForecastInput,
  languageCostUsd,
  voicePerMinute,
} from "@/lib/forecast";
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
 * The AI cost per minute starts from this month's real language-model
 * spend on created practices (api_calls without evals ÷ their minutes),
 * else the 2026-11-08 batch, plus paid voice (D184).
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
        .select("operation, cost_micros")
        .gte("created_at", monthStart),
      admin
        .from("practices")
        .select("estimated_seconds")
        .gte("created_at", monthStart)
        .not("estimated_seconds", "is", null),
    ]);
    const cost = languageCostUsd(calls ?? []);
    const minutes =
      (practices ?? []).reduce((s, p) => s + (p.estimated_seconds ?? 0), 0) /
      60;
    if (minutes >= 10 && cost > 0) {
      usdPerMinute = cost / minutes;
      measured = true;
    }
  }
  // Language models (measured) + voice once past the free tier (D184).
  const language = usdPerMinute * TWD_PER_USD;
  const voice = voicePerMinute(TWD_PER_USD);
  const round = (n: number) => Math.round(n * 100) / 100;
  const aiPerMinute = round(language + voice);
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">
        {t(measured ? "introMeasured" : "introFallback", {
          perMinute: aiPerMinute,
          language: round(language),
          voice: round(voice),
          rate: TWD_PER_USD,
        })}
      </p>
      <div className="mt-8">
        <ForecastCalculator initial={defaultForecastInput(aiPerMinute)} />
      </div>
    </main>
  );
}

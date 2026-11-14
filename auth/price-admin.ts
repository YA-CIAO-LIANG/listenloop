import { getAdminSupabase } from "@/auth/admin";
import {
  parseExperiment,
  variantStats,
  type ExperimentEvent,
  type PriceExperiment,
  type PriceOverride,
  type VariantStats,
} from "@/lib/price-experiments";
import type { PriceAnswers } from "@/lib/price-survey";

/** Rows read at most per experiment (a page of 1,000 at a time). */
const MAX_EVENTS = 20_000;

export type ExperimentReport = PriceExperiment & {
  createdAt: string;
  endedAt: string | null;
  note: string | null;
  stats: VariantStats[];
};

async function experimentEvents(id: string): Promise<ExperimentEvent[]> {
  const admin = getAdminSupabase();
  if (!admin) return [];
  const out: ExperimentEvent[] = [];
  for (let from = 0; from < MAX_EVENTS; from += 1000) {
    const { data, error } = await admin
      .from("intent_events")
      .select("user_id, visitor_id, step, plan, variant")
      .eq("experiment_id", id)
      .order("id")
      .range(from, from + 999);
    if (error || !data) break;
    for (const row of data) {
      if (!row.variant) continue;
      out.push({
        variant: row.variant,
        // The same subject the variant was chosen for (auth/prices.ts).
        subject: row.user_id ? `u:${row.user_id}` : `v:${row.visitor_id}`,
        step: row.step,
        plan: row.plan,
      });
    }
    if (data.length < 1000) break;
  }
  return out;
}

/** Every experiment, newest first, with each variant's funnel (D174). */
export async function getExperimentReports(): Promise<ExperimentReport[]> {
  const admin = getAdminSupabase();
  if (!admin) return [];
  const { data } = await admin
    .from("price_experiments")
    .select("id, plan, variants, status, winner, note, created_at, ended_at")
    .order("created_at", { ascending: false })
    .limit(20);
  const reports: ExperimentReport[] = [];
  for (const row of data ?? []) {
    const experiment = parseExperiment(row);
    if (!experiment) continue;
    reports.push({
      ...experiment,
      createdAt: row.created_at,
      endedAt: row.ended_at,
      note: row.note,
      stats: variantStats(experiment, await experimentEvents(experiment.id)),
    });
  }
  return reports;
}

export async function getPriceOverrides(): Promise<PriceOverride[]> {
  const admin = getAdminSupabase();
  if (!admin) return [];
  const { data } = await admin.from("price_overrides").select("plan, monthly");
  return (data ?? []) as PriceOverride[];
}

/** Every price survey answer (D174), for the curves. */
export async function getPriceSurveyAnswers(): Promise<PriceAnswers[]> {
  const admin = getAdminSupabase();
  if (!admin) return [];
  const { data } = await admin
    .from("price_survey_responses")
    .select("too_cheap, bargain, expensive, too_expensive")
    .limit(10_000);
  return (data ?? []).map((r) => ({
    tooCheap: r.too_cheap,
    bargain: r.bargain,
    expensive: r.expensive,
    tooExpensive: r.too_expensive,
  }));
}

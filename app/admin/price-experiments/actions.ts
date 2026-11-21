"use server";

import { revalidatePath } from "next/cache";
import { getAdminSupabase } from "@/auth/admin";
import { logAudit } from "@/auth/audit";
import { resetPriceCache } from "@/auth/prices";
import { getRecentAdmin } from "@/auth/recent-auth";
import { isUuid } from "@/lib/custom-practice/organize";
import {
  isPaidPlanId,
  parseExperiment,
  parseVariants,
} from "@/lib/price-experiments";
import {
  minimumMonthly,
  PLAN_MINUTES,
  PLAN_WRITING_REVIEWS,
} from "@/lib/payments/price-floor";

/**
 * Starting and ending price experiments (D174). Prices change what people
 * see, so both need a recent sign-in (D159) and are audited.
 */
export type ExperimentResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unavailable" | "invalid" | "running" | "failed" | "reauth";
    }
  /** A price under the floor (D185): `min` is the lowest allowed. */
  | { ok: false; reason: "belowFloor"; min: number };

export async function startPriceExperiment(
  input: unknown,
): Promise<ExperimentResult> {
  const user = await getRecentAdmin();
  if (user === "reauth") return { ok: false, reason: "reauth" };
  const admin = getAdminSupabase();
  if (!user || !admin) return { ok: false, reason: "unavailable" };
  const raw = (input ?? {}) as Record<string, unknown>;
  const variants = Array.isArray(raw.prices) ? parseVariants(raw.prices) : null;
  if (!isPaidPlanId(raw.plan) || !variants) {
    return { ok: false, reason: "invalid" };
  }
  // Even if everyone uses every minute, no price may lose money (D185).
  const min = minimumMonthly(
    PLAN_MINUTES[raw.plan],
    PLAN_WRITING_REVIEWS[raw.plan],
  );
  if (variants.some((v) => v.monthly < min)) {
    return { ok: false, reason: "belowFloor", min };
  }
  const note =
    typeof raw.note === "string" ? raw.note.trim().slice(0, 200) : "";
  const { data, error } = await admin
    .from("price_experiments")
    .insert({
      plan: raw.plan,
      variants,
      status: "running",
      note: note || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  // The unique index allows one running experiment.
  if (error) {
    return {
      ok: false,
      reason: error.code === "23505" ? "running" : "failed",
    };
  }
  await logAudit(
    user.id,
    "price.experiment.start",
    { type: "setting", id: `price-experiment-${data.id}` },
    { plan: raw.plan, prices: variants.map((v) => v.monthly) },
  );
  resetPriceCache();
  revalidatePath("/admin/price-experiments");
  return { ok: true };
}

/**
 * Ends the experiment. With `apply`, that variant's monthly price becomes
 * the plan's price for everyone (price_overrides); without, the plan goes
 * back to its price before.
 */
export async function endPriceExperiment(
  input: unknown,
): Promise<ExperimentResult> {
  const user = await getRecentAdmin();
  if (user === "reauth") return { ok: false, reason: "reauth" };
  const admin = getAdminSupabase();
  if (!user || !admin) return { ok: false, reason: "unavailable" };
  const raw = (input ?? {}) as Record<string, unknown>;
  if (!isUuid(raw.id)) return { ok: false, reason: "invalid" };
  const { data: row } = await admin
    .from("price_experiments")
    .select("id, plan, variants, status, winner")
    .eq("id", raw.id)
    .maybeSingle();
  const experiment = row ? parseExperiment(row) : null;
  if (!experiment || experiment.status !== "running") {
    return { ok: false, reason: "invalid" };
  }
  const winner =
    raw.apply === null || raw.apply === undefined
      ? null
      : experiment.variants.find((v) => v.key === raw.apply);
  if (winner === undefined) return { ok: false, reason: "invalid" };
  const { error } = await admin
    .from("price_experiments")
    .update({
      status: "ended",
      winner: winner?.key ?? null,
      ended_at: new Date().toISOString(),
    })
    .eq("id", experiment.id);
  if (error) return { ok: false, reason: "failed" };
  if (winner) {
    const { error: applyError } = await admin.from("price_overrides").upsert(
      {
        plan: experiment.plan,
        monthly: winner.monthly,
        experiment_id: experiment.id,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "plan" },
    );
    if (applyError) return { ok: false, reason: "failed" };
  }
  await logAudit(
    user.id,
    "price.experiment.end",
    { type: "setting", id: `price-experiment-${experiment.id}` },
    { plan: experiment.plan, applied: winner?.monthly ?? null },
  );
  resetPriceCache();
  revalidatePath("/admin/price-experiments");
  revalidatePath("/pricing");
  return { ok: true };
}

/** Removes an applied price: the plan goes back to the code's price. */
export async function clearPriceOverride(
  input: unknown,
): Promise<ExperimentResult> {
  const user = await getRecentAdmin();
  if (user === "reauth") return { ok: false, reason: "reauth" };
  const admin = getAdminSupabase();
  if (!user || !admin) return { ok: false, reason: "unavailable" };
  const plan = (input as { plan?: unknown } | null)?.plan;
  if (!isPaidPlanId(plan)) return { ok: false, reason: "invalid" };
  const { error } = await admin
    .from("price_overrides")
    .delete()
    .eq("plan", plan);
  if (error) return { ok: false, reason: "failed" };
  await logAudit(
    user.id,
    "price.override.clear",
    { type: "setting", id: `price-${plan}` },
    { plan },
  );
  resetPriceCache();
  revalidatePath("/admin/price-experiments");
  return { ok: true };
}

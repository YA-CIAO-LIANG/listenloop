"use server";

import { getRecentAdmin } from "@/auth/recent-auth";
import { revalidatePath } from "next/cache";
import { getAdminSupabase } from "@/auth/admin";
import { logAudit } from "@/auth/audit";
import { getAdminUser } from "@/auth/creator";
import { getPaymentProvider, isFakeProvider } from "@/auth/payments";

export type RevenueActionResult =
  | { ok: true }
  | { ok: false; reason: "unavailable" | "not-found" | "failed" | "reauth" };

/**
 * Refunds a payment in full (D85), through the provider; its webhook then
 * marks the payment refunded. Recorded in the admin audit.
 */
export async function refundPayment(
  paymentId: unknown,
): Promise<RevenueActionResult> {
  // Risky: a sign-in within 30 minutes (D159).
  const [user, provider, admin] = [
    await getRecentAdmin(),
    getPaymentProvider(),
    getAdminSupabase(),
  ];
  if (user === "reauth") return { ok: false, reason: "reauth" };
  if (!user || !provider || !admin) return { ok: false, reason: "unavailable" };
  if (typeof paymentId !== "string") return { ok: false, reason: "not-found" };
  const { data: payment } = await admin
    .from("payments")
    .select("user_id, provider_payment_id, amount, currency, status")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment || payment.status !== "paid") {
    return { ok: false, reason: "not-found" };
  }
  try {
    await provider.refund(payment.provider_payment_id);
  } catch {
    return { ok: false, reason: "failed" };
  }
  await logAudit(
    user.id,
    "payment_refund",
    { type: "user", id: payment.user_id },
    { amount: payment.amount, currency: payment.currency },
  );
  revalidatePath("/admin/revenue");
  return { ok: true };
}

/**
 * The fake provider only: makes a subscription renew, fail a payment, or
 * expire now, as a real provider would later on its own (D85).
 */
export async function simulateSubscription(
  userId: unknown,
  change: unknown,
): Promise<RevenueActionResult> {
  const [user, provider, admin] = [
    await getAdminUser(),
    getPaymentProvider(),
    getAdminSupabase(),
  ];
  if (!user || !isFakeProvider(provider) || !admin) {
    return { ok: false, reason: "unavailable" };
  }
  if (
    typeof userId !== "string" ||
    (change !== "renew" && change !== "past_due" && change !== "expire")
  ) {
    return { ok: false, reason: "not-found" };
  }
  const { data: sub } = await admin
    .from("subscriptions")
    .select("provider_subscription_id, billing_interval, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (!sub) return { ok: false, reason: "not-found" };
  try {
    await provider.simulate(
      {
        subscriptionId: sub.provider_subscription_id,
        userId,
        interval: sub.billing_interval === "year" ? "year" : "month",
        periodEnd: sub.current_period_end,
      },
      change,
    );
  } catch {
    return { ok: false, reason: "failed" };
  }
  await logAudit(
    user.id,
    `subscription_${change}`,
    { type: "user", id: userId },
    { test: true },
  );
  revalidatePath("/admin/revenue");
  return { ok: true };
}

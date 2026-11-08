import { getAdminSupabase } from "./admin";
import { applyPaymentEvent, type PaymentStore } from "@/lib/payments/apply";
import { fakePaymentProvider, type FakeProvider } from "@/lib/payments/fake";
import type { PaymentProvider } from "@/lib/payments/types";

type Admin = NonNullable<ReturnType<typeof getAdminSupabase>>;

/**
 * The payment provider in use (D85), from the environment:
 * PAYMENTS_PROVIDER picks it ("fake" for now; a real one is added in
 * lib/payments/ and named here) and PAYMENTS_WEBHOOK_SECRET signs its
 * webhooks. Null when payments are off: the pricing page then says
 * "coming soon" and offers the waiting list. The fake provider is never
 * used on the production site, whatever the setting.
 */
export function getPaymentProvider(
  env: Record<string, string | undefined> = process.env,
): PaymentProvider | null {
  const secret = env.PAYMENTS_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) return null;
  if (env.PAYMENTS_PROVIDER === "fake" && env.VERCEL_ENV !== "production") {
    return fakePaymentProvider({
      secret,
      // The fake "provider" calls our webhook handler directly.
      deliver: async (body, headers) => {
        const result = await handlePaymentWebhook(body, headers, env);
        if (result.status !== 200) {
          throw new Error(`fake webhook refused: ${result.status}`);
        }
      },
    });
  }
  return null;
}

export const isFakeProvider = (
  provider: PaymentProvider | null,
): provider is FakeProvider => provider?.id === "fake";

/**
 * A webhook request (D85): verify, then apply once. 400 for anything not
 * signed with our secret (or replayed), 200 for a repeat, 500 when it
 * couldn't be applied, so the provider tries again later.
 */
export async function handlePaymentWebhook(
  rawBody: string,
  headers: Headers,
  env: Record<string, string | undefined> = process.env,
): Promise<{ status: number; body: string }> {
  const provider = getPaymentProvider(env);
  const admin = getAdminSupabase();
  if (!provider || !admin) return { status: 404, body: "payments are off" };
  const event = await provider.parseWebhook(rawBody, headers, new Date());
  if (!event) return { status: 400, body: "invalid signature or event" };
  const result = await applyPaymentEvent(
    supabasePaymentStore(admin),
    provider.id,
    event,
  );
  if (!result.ok) {
    console.error(`[payments] ${event.type} ${event.id}: ${result.reason}`);
    return { status: 500, body: result.reason };
  }
  return { status: 200, body: result.outcome };
}

/** PaymentStore on the database, with the secret key (server only). */
export function supabasePaymentStore(admin: Admin): PaymentStore {
  const check = ({ error }: { error: { message: string } | null }) => {
    if (error) throw new Error(error.message);
  };
  return {
    async claimEvent(provider, id, type) {
      const { data, error } = await admin
        .from("payment_events")
        .upsert(
          { provider, event_id: id, type },
          { onConflict: "provider,event_id", ignoreDuplicates: true },
        )
        .select("event_id");
      if (error) throw new Error(error.message);
      return (data ?? []).length > 0;
    },
    async releaseEvent(provider, id) {
      check(
        await admin
          .from("payment_events")
          .delete()
          .eq("provider", provider)
          .eq("event_id", id),
      );
    },
    async getSubscription(userId) {
      const { data } = await admin
        .from("subscriptions")
        .select("status, updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      return data
        ? {
            status: data.status as "active" | "past_due" | "expired",
            updatedAt: data.updated_at,
          }
        : null;
    },
    async saveSubscription(row) {
      check(
        await admin.from("subscriptions").upsert({
          user_id: row.userId,
          provider: row.provider,
          provider_subscription_id: row.subscriptionId,
          status: row.status,
          billing_interval: row.interval,
          current_period_end: row.periodEnd,
          cancel_at_period_end: row.cancelAtPeriodEnd,
          test: row.test,
          updated_at: row.updatedAt,
        }),
      );
    },
    async setPlan(userId, plan) {
      check(
        await admin.from("profiles").update({ plan }).eq("user_id", userId),
      );
    },
    async savePayment(row) {
      check(
        await admin.from("payments").upsert(
          {
            user_id: row.userId,
            provider: row.provider,
            provider_payment_id: row.paymentId,
            amount: row.amount,
            currency: row.currency,
            billing_interval: row.interval,
            status: "paid",
            test: row.test,
            created_at: row.createdAt,
          },
          { onConflict: "provider_payment_id", ignoreDuplicates: true },
        ),
      );
    },
    async markRefunded(provider, paymentId, at) {
      const { data, error } = await admin
        .from("payments")
        .update({ status: "refunded", refunded_at: at })
        .eq("provider", provider)
        .eq("provider_payment_id", paymentId)
        .select("id");
      if (error) throw new Error(error.message);
      return (data ?? []).length > 0;
    },
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getOwnBilling } from "@/auth/billing";
import { getPaymentProvider, isFakeProvider } from "@/auth/payments";
import { allowAction } from "@/auth/rate-limit";
import { getSignedInUser } from "@/auth/session";
import { isBillingInterval } from "@/lib/payments/pricing";

/** This site's address, for the provider's return links. */
async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/**
 * Starts paying for the paid plan (D85): sends the signed-in account to
 * the provider's checkout. Off (back to the pricing page) while there's
 * no provider, and for accounts that already subscribe.
 */
export async function startCheckout(formData: FormData): Promise<void> {
  const interval = formData.get("interval");
  const [user, provider] = [await getSignedInUser(), getPaymentProvider()];
  if (!user || !provider || !isBillingInterval(interval)) redirect("/pricing");
  if (!(await allowAction("billing", user.id))) redirect("/checkout/failed");
  const { subscription } = await getOwnBilling(user.id);
  if (subscription && subscription.status !== "expired") redirect("/account");
  const base = await origin();
  const { url } = await provider.createCheckout({
    userId: user.id,
    email: user.email || null,
    interval,
    successUrl: `${base}/checkout/success`,
    cancelUrl: `${base}/pricing`,
  });
  redirect(url);
}

/** The fake checkout page's buttons (D85): pay, or fail, without money. */
export async function completeFakeCheckout(formData: FormData): Promise<void> {
  const interval = formData.get("interval");
  const [user, provider] = [await getSignedInUser(), getPaymentProvider()];
  if (!user || !isFakeProvider(provider) || !isBillingInterval(interval)) {
    redirect("/pricing");
  }
  if (formData.get("outcome") !== "pay") redirect("/checkout/failed");
  await provider.completeCheckout(user.id, interval);
  revalidatePath("/", "layout");
  redirect("/checkout/success");
}

/**
 * Stops renewing at the end of the paid period, or renews again (D85).
 * The provider confirms with a webhook, which updates the account.
 */
export async function setCancelAtPeriodEnd(formData: FormData): Promise<void> {
  const cancel = formData.get("cancel") === "1";
  const [user, provider] = [await getSignedInUser(), getPaymentProvider()];
  if (!user || !provider) redirect("/account");
  if (!(await allowAction("billing", user.id))) redirect("/account#billing");
  const { subscription } = await getOwnBilling(user.id);
  if (subscription && subscription.status !== "expired") {
    await provider.setCancelAtPeriodEnd(
      { ...subscription, userId: user.id },
      cancel,
    );
  }
  revalidatePath("/account");
  redirect("/account#billing");
}

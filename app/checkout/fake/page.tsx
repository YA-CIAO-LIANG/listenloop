import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { completeFakeCheckout } from "@/app/billing/actions";
import { getPaymentProvider, isFakeProvider } from "@/auth/payments";
import { getSignedInUser } from "@/auth/session";
import { Button } from "@/components/Button";
import { isBillingInterval, PRICES } from "@/lib/payments/pricing";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("checkout");
  return { title: t("fakeTitle"), robots: { index: false, follow: false } };
}

/**
 * The fake provider's checkout (D85): stands in for a real provider's
 * payment page in development and tests. 404 with any other provider.
 */
export default async function FakeCheckoutPage({
  searchParams,
}: PageProps<"/checkout/fake">) {
  if (!isFakeProvider(getPaymentProvider())) notFound();
  const [t, tPricing, user, { interval }] = await Promise.all([
    getTranslations("checkout"),
    getTranslations("pricing"),
    getSignedInUser(),
    searchParams,
  ]);
  if (!user || !isBillingInterval(interval)) redirect("/pricing");
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("fakeTitle")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("fakeIntro")}</p>
      <dl className="mt-8 max-w-reading space-y-1">
        <dt className="sr-only">{tPricing("intervalLabel")}</dt>
        <dd>
          {t("plan", {
            interval: tPricing(interval === "month" ? "monthly" : "yearly"),
          })}
        </dd>
        <dd>{t("amount", { amount: PRICES[interval].amount })}</dd>
      </dl>
      <form action={completeFakeCheckout} className="mt-8 flex flex-wrap gap-3">
        <input type="hidden" name="interval" value={interval} />
        <Button type="submit" name="outcome" value="pay" variant="primary">
          {t("pay")}
        </Button>
        <Button type="submit" name="outcome" value="fail">
          {t("fail")}
        </Button>
      </form>
    </main>
  );
}

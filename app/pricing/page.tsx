import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getPaymentProvider } from "@/auth/payments";
import { getSignedInUser } from "@/auth/session";
import { onWaitlist } from "@/app/plans/actions";
import { PricingPlans } from "@/components/PricingPlans";
import { planFor } from "@/lib/plans";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pricing");
  return { title: t("title"), description: t("intro") };
}

/**
 * Plans and pricing (D85): public. The paid plan's checkout appears only
 * when a payment provider is set up; until then it's "coming soon" with
 * the waiting list.
 */
export default async function PricingPage() {
  const [t, user, joined] = await Promise.all([
    getTranslations("pricing"),
    getSignedInUser(),
    onWaitlist(),
  ]);
  const provider = getPaymentProvider();
  const payments = !provider ? "off" : provider.test ? "test" : "live";
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      <div className="mt-8">
        <PricingPlans
          payments={payments}
          signedIn={user !== null}
          paid={user !== null && planFor(user) !== "free"}
          joined={joined}
        />
      </div>
    </main>
  );
}

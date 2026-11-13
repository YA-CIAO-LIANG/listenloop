import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getSignedInUser } from "@/auth/session";
import { onWaitlist } from "@/app/plans/actions";
import { PricingPlans } from "@/components/PricingPlans";
import { isIntentSource } from "@/lib/intent";
import { isBillingPeriod, isPaidPlan } from "@/lib/payments/pricing";
import { planFor } from "@/lib/plans";
import { studentStatus } from "@/lib/student";
import { publicPageMetadata } from "@/i18n/metadata";

/** Title, description, canonical, and hreflang (D167). */
export function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata("/pricing");
}

/**
 * Plans and pricing (D102): public. Paying isn't open yet, so subscribing
 * is a fake door with the waiting list; `?from=` says which page sent the
 * visitor, and `?plan=&period=` (back from signing in) reopens the offer.
 */
export default async function PricingPage({
  searchParams,
}: PageProps<"/pricing">) {
  const [t, user, joined, params] = await Promise.all([
    getTranslations("pricing"),
    getSignedInUser(),
    onWaitlist(),
    searchParams,
  ]);
  const plan = user ? planFor(user) : null;
  const source = isIntentSource(params.from) ? params.from : "direct";
  const open =
    isPaidPlan(params.plan) && isBillingPeriod(params.period)
      ? { plan: params.plan, period: params.period }
      : null;
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      <div className="mt-8">
        <PricingPlans
          signedIn={user !== null}
          current={
            plan === null || plan === "admin"
              ? null
              : plan === "paid"
                ? "plus"
                : plan
          }
          joined={joined}
          source={source}
          open={open}
          student={user ? studentStatus(user.studentVerifiedAt) : null}
        />
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getSignedInUser } from "@/auth/session";
import { ButtonLink } from "@/components/ButtonLink";
import { planFor } from "@/lib/plans";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("checkout");
  return { title: t("successTitle"), robots: { index: false, follow: false } };
}

/**
 * Back from a successful checkout (D85). The plan changes when the
 * provider's webhook arrives, which can take a moment: until then, the
 * page says the payment is being confirmed.
 */
export default async function CheckoutSuccessPage() {
  const [t, user] = await Promise.all([
    getTranslations("checkout"),
    getSignedInUser(),
  ]);
  const ready = user !== null && planFor(user) !== "free";
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("successTitle")}</h1>
      <p role="status" className="mt-4 max-w-reading text-ink-muted">
        {ready ? t("successIntro") : t("successPending")}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        {ready && (
          <ButtonLink href="/materials/new" variant="primary">
            {t("create")}
          </ButtonLink>
        )}
        <ButtonLink href="/account#billing">{t("account")}</ButtonLink>
      </div>
    </main>
  );
}

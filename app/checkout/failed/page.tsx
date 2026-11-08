import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ButtonLink";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("checkout");
  return { title: t("failedTitle"), robots: { index: false, follow: false } };
}

/** A checkout that didn't go through (D85): nothing was charged. */
export default async function CheckoutFailedPage() {
  const t = await getTranslations("checkout");
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("failedTitle")}</h1>
      <p role="alert" className="mt-4 max-w-reading text-ink-muted">
        {t("failedIntro")}
      </p>
      <div className="mt-8">
        <ButtonLink href="/pricing">{t("back")}</ButtonLink>
      </div>
    </main>
  );
}

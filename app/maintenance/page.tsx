import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ButtonLink";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ops.maintenance");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Shown instead of every page in maintenance mode (D155): the proxy
 * rewrites here with a 503. Opened directly, it's just the notice.
 */
export default async function MaintenancePage() {
  const t = await getTranslations("ops.maintenance");
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-16 split:px-6">
      <p className="text-metadata tracking-widest text-ink-muted uppercase">
        503
      </p>
      <h1 className="mt-2 font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("body")}</p>
      <div className="mt-8">
        <ButtonLink href="/status" variant="secondary" arrow>
          {t("status")}
        </ButtonLink>
      </div>
    </main>
  );
}

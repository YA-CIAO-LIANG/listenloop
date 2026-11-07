import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ButtonLink";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("offline");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * What the service worker shows without a connection (D64): cached once,
 * in the interface language of the moment, so it says what still works.
 * Its one button goes home, which reloads once the connection is back.
 */
export default async function OfflinePage() {
  const t = await getTranslations("offline");
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-16 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("body")}</p>
      <p className="mt-4 max-w-reading text-ink-muted">{t("progress")}</p>
      <div className="mt-8">
        {/* Without a connection Next falls back to a full page load. */}
        <ButtonLink href="/" variant="primary">
          {t("retry")}
        </ButtonLink>
      </div>
    </main>
  );
}

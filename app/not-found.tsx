import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ButtonLink";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("states.notFound");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** 404, in the interface language (D61). */
export default async function NotFound() {
  const t = await getTranslations("states.notFound");
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-16 split:px-6">
      <p className="text-metadata tracking-widest text-ink-muted uppercase">
        404
      </p>
      <h1 className="mt-2 font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("body")}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/" variant="primary" arrow>
          {t("home")}
        </ButtonLink>
        <ButtonLink href="/feedback" variant="ghost">
          {t("report")}
        </ButtonLink>
      </div>
    </main>
  );
}

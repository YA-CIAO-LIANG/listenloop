import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/JsonLd";
import { publicPageMetadata } from "@/i18n/metadata";
import { FAQ_GROUPS, FAQ_IDS } from "@/lib/faq";
import { faqPage } from "@/lib/structured-data";

/** Title, description, canonical, and hreflang (D167). */
export function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata("/faq");
}

/**
 * Frequently asked questions (D167): public, linked from the footer. The
 * answers are always shown (not folded away), and the FAQPage data
 * repeats the same text.
 */
export default async function FaqPage() {
  const t = await getTranslations("faq");
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>

      <div className="mt-10 max-w-reading space-y-12">
        {FAQ_GROUPS.map((group) => (
          <section key={group.id} aria-labelledby={`faq-${group.id}`}>
            <h2 id={`faq-${group.id}`} className="font-display text-h2">
              {t(`groups.${group.id}`)}
            </h2>
            <dl className="mt-4 divide-y divide-line border-y border-line">
              {group.items.map((id) => (
                <div key={id} className="py-5">
                  <dt className="font-display text-h3">
                    {t(`items.${id}.question`)}
                  </dt>
                  <dd className="mt-2 text-ink-muted">
                    {t(`items.${id}.answer`)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <p className="mt-12 text-ink-muted">
        {t("more")}{" "}
        <Link
          href="/feedback"
          className="tap text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
        >
          {t("feedback")}
        </Link>
      </p>

      <JsonLd
        data={faqPage(
          FAQ_IDS.map((id) => ({
            question: t(`items.${id}.question`),
            answer: t(`items.${id}.answer`),
          })),
        )}
      />
    </main>
  );
}

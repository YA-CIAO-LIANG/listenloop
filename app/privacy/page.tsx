import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacy");
  return { title: t("title") };
}

/** Where to ask about privacy (docs/decisions.md D17). */
export const PRIVACY_CONTACT_URL =
  "https://github.com/YA-CIAO-LIANG/listenloop/issues";

type Section = { title: string; paragraphs: string[]; items?: string[] };

/**
 * The privacy policy (Google sign-in needs a public one). The text lives
 * in the translation files (privacy.sections), in reading order.
 */
export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  const sections = t.raw("sections") as Section[];

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-2 text-supporting text-ink-muted">{t("updated")}</p>
      <p className="mt-6 max-w-reading">{t("intro")}</p>
      {sections.map((section) => (
        <section key={section.title} className="mt-12 max-w-reading">
          <h2 className="font-display text-h3">{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="mt-4 text-ink-muted">
              {paragraph}
            </p>
          ))}
          {section.items && (
            <ul className="mt-4 list-disc space-y-2 pl-5 text-ink-muted">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <p className="mt-12 max-w-reading">
        {t("contact")}{" "}
        <a
          href={PRIVACY_CONTACT_URL}
          className="text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
        >
          {t("contactLink")}
        </a>
      </p>
    </main>
  );
}

import Link from "next/link";
import { getTranslations } from "next-intl/server";

type Section = { title: string; paragraphs: string[]; items?: string[] };

/**
 * A legal page (privacy policy, terms of service; D60): title, last
 * update, intro, numbered or titled sections from the translation files,
 * and where to ask questions (the feedback form).
 */
export async function LegalPage({
  namespace,
}: {
  namespace: "privacy" | "terms";
}) {
  const t = await getTranslations(namespace);
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
        <Link
          href="/feedback"
          className="text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
        >
          {t("contactLink")}
        </Link>
      </p>
    </main>
  );
}

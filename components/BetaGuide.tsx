import Link from "next/link";
import { getTranslations } from "next-intl/server";

type Section = { title: string; items: string[] };

/**
 * What a Beta tester needs to know (D212): signing up, each day's task,
 * the time it takes, reporting problems, and privacy. On /beta, a page
 * that can be sent to testers as it is.
 */
export async function BetaGuide() {
  const t = await getTranslations("beta.guide");
  const sections = t.raw("sections") as Section[];
  return (
    <section aria-labelledby="beta-guide" className="mt-10 max-w-reading">
      <h2 id="beta-guide" className="font-display text-h2">
        {t("title")}
      </h2>
      <p className="mt-2 text-ink-muted">{t("intro")}</p>
      {sections.map((section, i) => (
        <div key={section.title} className="mt-6">
          <h3 className="font-display text-h3">
            {i + 1}. {section.title}
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
      <p className="mt-6">
        <Link
          href="/privacy"
          className="text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
        >
          {t("privacyLink")}
        </Link>
      </p>
    </section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getLibraryItems } from "@/auth/library";
import { LEARN_CATEGORIES, learnPath } from "@/lib/learn";
import { publicPageMetadata } from "@/i18n/metadata";

/** Title, description, canonical, and hreflang (D167). */
export function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata("/learn");
}

/** Every topic's landing page (D116), with how many materials each has. */
export default async function LearnIndexPage() {
  const [t, tNames, items] = await Promise.all([
    getTranslations("learn"),
    getTranslations("categories.names"),
    getLibraryItems(),
  ]);
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("indexTitle")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("indexIntro")}</p>
      <ul className="mt-8 grid gap-4 split:grid-cols-2 wide:grid-cols-3">
        {LEARN_CATEGORIES.map((category) => {
          const count = items.filter((i) => i.category === category).length;
          return (
            <li key={category}>
              <Link
                href={learnPath(category)}
                className="tap block h-full rounded-base border border-line surface-card p-5 hover:border-ink"
              >
                <span className="block font-display text-h3">
                  {t("pageTitle", { name: tNames(category) })}
                </span>
                <span className="mt-2 block text-supporting text-ink-muted">
                  {t("count", { count })}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

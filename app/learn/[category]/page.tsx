import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getLibraryItems } from "@/auth/library";
import { ButtonLink } from "@/components/ButtonLink";
import { MaterialCard } from "@/components/MaterialCard";
import { isLearnCategory, learnPath } from "@/lib/learn";
import { filterLibrary, NO_LIBRARY_FILTER } from "@/lib/library";
import { SITE_URL } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/learn/[category]">): Promise<Metadata> {
  const { category } = await params;
  if (!isLearnCategory(category)) return {};
  const [t, tNames] = await Promise.all([
    getTranslations("learn"),
    getTranslations("categories.names"),
  ]);
  const title = t("pageTitle", { name: tNames(category) });
  const description = t(`intros.${category}`);
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}${learnPath(category)}` },
    openGraph: { title, description },
  };
}

/**
 * A topic's landing page (D116): what practicing this topic is like, how
 * the 7-day loop works, and every official material in it, for search
 * engines and newcomers. Public; no sign-in.
 */
export default async function LearnCategoryPage({
  params,
}: PageProps<"/learn/[category]">) {
  const { category } = await params;
  if (!isLearnCategory(category)) notFound();
  const [t, tNames, all] = await Promise.all([
    getTranslations("learn"),
    getTranslations("categories.names"),
    getLibraryItems(),
  ]);
  const items = filterLibrary(all, {
    ...NO_LIBRARY_FILTER,
    categories: [category],
  });
  const name = tNames(category);

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <Link
        href="/learn"
        className="tap text-supporting text-ink-muted hover:text-ink"
      >
        <span aria-hidden="true">← </span>
        {t("back")}
      </Link>
      <h1 className="mt-6 font-display text-h1">{t("pageTitle", { name })}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">
        {t(`intros.${category}`)}
      </p>

      <section aria-labelledby="learn-how" className="mt-10">
        <h2 id="learn-how" className="font-display text-h2">
          {t("howTitle")}
        </h2>
        <ol className="mt-4 grid gap-4 split:grid-cols-3">
          {(["day1", "days2to6", "day7"] as const).map((step, i) => (
            <li key={step} className="space-y-1">
              <p className="font-display text-h3">
                <span className="text-accent-ink tabular-nums">{i + 1}</span>{" "}
                {t(`steps.${step}.title`)}
              </p>
              <p className="text-supporting text-ink-muted">
                {t(`steps.${step}.body`)}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="learn-materials" className="mt-12">
        <h2 id="learn-materials" className="font-display text-h2">
          {t("materialsTitle", { name, count: items.length })}
        </h2>
        {items.length === 0 ? (
          <p className="mt-4 text-ink-muted">{t("none")}</p>
        ) : (
          <ul className="mt-6 grid gap-4 split:grid-cols-2 wide:grid-cols-3">
            {items.map((item) => (
              <li key={item.id}>
                <MaterialCard item={item} />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          {items[0] && (
            <ButtonLink href={`/videos/${items[0].id}`} variant="primary" arrow>
              {t("startFirst")}
            </ButtonLink>
          )}
          <ButtonLink href="/level-test" variant="secondary">
            {t("levelTest")}
          </ButtonLink>
          <ButtonLink href={`/?cat=${category}#library`} variant="ghost">
            {t("library")}
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}

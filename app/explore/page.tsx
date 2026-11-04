import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { listPublicPractices } from "@/auth/public-practices";
import { ExploreList } from "@/components/ExploreList";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("explore");
  return { title: t("title") };
}

/**
 * "Shared materials" (D30): practices people made public, for anyone to
 * browse and practice, signed in or not.
 */
export default async function ExplorePage() {
  const [t, practices] = await Promise.all([
    getTranslations("explore"),
    listPublicPractices(),
  ]);

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      <ExploreList practices={practices} />
    </main>
  );
}

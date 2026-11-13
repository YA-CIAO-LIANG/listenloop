import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getSharedForEveryone, practiceSeconds } from "@/auth/library";
import { getSignedInUser } from "@/auth/session";
import { listPublicPractices } from "@/auth/public-practices";
import { ExploreList } from "@/components/ExploreList";
import { publicPageMetadata } from "@/i18n/metadata";

/** Title, description, canonical, and hreflang (D167). */
export function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata("/explore");
}

/**
 * "Shared materials" (D30): practices people made public, for anyone to
 * browse and practice, signed in or not.
 */
export default async function ExplorePage() {
  const [t, user] = await Promise.all([
    getTranslations("explore"),
    getSignedInUser(),
  ]);
  // Signed out, everyone sees the same list: cached (D133). Signed in,
  // it marks the viewer's own, so it's read for them.
  const { practices, seconds } = user
    ? await (async () => {
        const practices = await listPublicPractices();
        const seconds = await practiceSeconds(practices.map((p) => p.id));
        return { practices, seconds: Object.fromEntries(seconds) };
      })()
    : await getSharedForEveryone();

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      <ExploreList practices={practices} seconds={seconds} />
    </main>
  );
}

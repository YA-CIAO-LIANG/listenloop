import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { getLibraryItems, getSavedLibraryDefault } from "@/auth/library";
import {
  MaterialLibrary,
  UnfilteredMaterialLibrary,
} from "@/components/MaterialLibrary";
import { BetaNote } from "@/components/BetaNote";
import { FixedReportsNotice } from "@/components/FixedReportsNotice";
import { OnboardingStart } from "@/components/OnboardingStart";
import { ProductIntro } from "@/components/ProductIntro";
import { QuickStart } from "@/components/QuickStart";
import { ProgressGate } from "@/components/ProgressGate";
import { LibrarySkeleton } from "@/components/Skeleton";
import { HomeProgress } from "@/components/HomeProgress";
import type { LibraryItem } from "@/lib/library";
import { JsonLd } from "@/components/JsonLd";
import { publicPageMetadata } from "@/i18n/metadata";
import { defaultLocale } from "@/lib/i18n/config";
import { localizedUrl } from "@/lib/seo";
import { webApplication } from "@/lib/structured-data";

/** The home page's own title, description, canonical, hreflang (D167). */
export function generateMetadata() {
  return publicPageMetadata("/");
}

/**
 * The home page (D79). Signed in: the practice calendar, today's tasks,
 * then the official library. Signed out: what the seven-day loop is,
 * then the library. The library is for everyone, with "how many minutes
 * do I have today?" on top.
 */
export default function Home() {
  const t = useTranslations();
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-16 split:px-6">
      <h1 className="font-display text-hero">{t("common.appName")}</h1>
      <p className="mt-4 font-display text-h3">{t("home.tagline")}</p>
      {/* Who it's for and how, readable in five seconds (D119). */}
      <p className="mt-3 max-w-reading text-ink-muted">{t("home.audience")}</p>
      {/* First visit: straight to Day 1's first sentence (D169). */}
      <QuickStart />
      {/* In Beta, with a way to tell us what to fix (D132). */}
      <BetaNote className="mt-6" />
      {/* What search engines read about the app (D167). */}
      <JsonLd
        data={webApplication({
          name: t("metadata.siteName"),
          description: t("metadata.description"),
          url: localizedUrl("/", defaultLocale),
        })}
      />

      <div className="mt-12 space-y-6">
        {/* Not in Suspense: it's in the first HTML, so nothing shifts (D62). */}
        <OnboardingStart />
        <ProgressGate place="home" signedOut={<ProductIntro />}>
          <FixedReportsNotice />
          <HomeProgress />
        </ProgressGate>
      </div>

      <section id="library" className="mt-16 scroll-mt-8">
        <h2 className="font-display text-h2">{t("library.title")}</h2>
        <p className="mt-2 text-ink-muted">{t("library.intro")}</p>
        {/* Official practices come from the database (D61). */}
        <Suspense fallback={<LibrarySkeleton label={t("states.loading")} />}>
          <Library />
        </Suspense>
      </section>
    </main>
  );
}

async function Library() {
  const [items, savedDefault]: [LibraryItem[], string | null | undefined] =
    await Promise.all([getLibraryItems(), getSavedLibraryDefault()]);
  return (
    <Suspense fallback={<UnfilteredMaterialLibrary items={items} />}>
      <MaterialLibrary items={items} savedDefault={savedDefault} />
    </Suspense>
  );
}

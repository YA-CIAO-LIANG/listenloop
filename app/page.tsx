import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { getLibraryItems } from "@/auth/library";
import {
  MaterialLibrary,
  UnfilteredMaterialLibrary,
} from "@/components/MaterialLibrary";
import { OnboardingStart } from "@/components/OnboardingStart";
import { PracticeCalendar } from "@/components/PracticeCalendar";
import { ProductIntro } from "@/components/ProductIntro";
import { ProgressGate } from "@/components/ProgressGate";
import { LibrarySkeleton } from "@/components/Skeleton";
import { TodayTasks } from "@/components/TodayTasks";
import type { LibraryItem } from "@/lib/library";

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

      <div className="mt-12 space-y-6">
        {/* Not in Suspense: it's in the first HTML, so nothing shifts (D62). */}
        <OnboardingStart />
        <ProgressGate place="home" signedOut={<ProductIntro />}>
          <PracticeCalendar />
          <TodayTasks />
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
  const items: LibraryItem[] = await getLibraryItems();
  return (
    <Suspense fallback={<UnfilteredMaterialLibrary items={items} />}>
      <MaterialLibrary items={items} />
    </Suspense>
  );
}

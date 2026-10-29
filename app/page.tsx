import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { PracticeCalendar } from "@/components/PracticeCalendar";
import {
  PracticeLibrary,
  UnfilteredLibrary,
  type LibraryGroup,
} from "@/components/PracticeLibrary";
import { TodayTasks } from "@/components/TodayTasks";
import { excerptSeconds } from "@/lib/excerpt-length";
import { getVideosByCollection } from "@/lib/video-library";

export default function Home() {
  const t = useTranslations();
  const groups: LibraryGroup[] = getVideosByCollection().map(
    ({ collection, videos }) => ({
      collection,
      videos: videos.map((video) => ({
        id: video.id,
        title: video.title,
        level: video.level,
        category: video.category,
        source: video.source,
        sentenceCount: video.sentences.length,
        seconds: excerptSeconds(video.sentences),
      })),
    }),
  );

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-16 split:px-6">
      <h1 className="font-display text-hero">{t("common.appName")}</h1>
      <p className="mt-4 font-display text-h3">{t("home.tagline")}</p>

      <div className="mt-12 space-y-6">
        <PracticeCalendar />
        <TodayTasks />
      </div>

      <section id="library" className="mt-16 scroll-mt-8">
        <h2 className="font-display text-h2">{t("library.title")}</h2>
        <p className="mt-2 text-ink-muted">{t("library.intro")}</p>
        <Suspense fallback={<UnfilteredLibrary groups={groups} />}>
          <PracticeLibrary groups={groups} />
        </Suspense>
      </section>
    </main>
  );
}

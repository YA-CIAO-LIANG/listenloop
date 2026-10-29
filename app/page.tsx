import { useTranslations } from "next-intl";
import { CardLink } from "@/components/CardLink";
import { PracticeCalendar } from "@/components/PracticeCalendar";
import { TodayTasks } from "@/components/TodayTasks";
import { VideoProgressLabel } from "@/components/VideoProgressLabel";
import { getVideosByCollection } from "@/lib/video-library";

export default function Home() {
  const t = useTranslations();

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
        {getVideosByCollection().map(({ collection, videos }) => (
          <section
            key={collection}
            aria-labelledby={`collection-${collection}`}
            className="mt-12"
          >
            <h3
              id={`collection-${collection}`}
              className="flex flex-wrap items-baseline gap-x-3 font-display text-h3"
            >
              {t(`collections.${collection}.title`)}
              <span className="text-supporting font-normal text-ink-muted">
                {t("library.videoCount", { count: videos.length })}
              </span>
            </h3>
            <p className="mt-1 text-supporting text-ink-muted">
              {t(`collections.${collection}.intro`)}
            </p>
            <ul className="mt-6 grid gap-6 split:grid-cols-2">
              {videos.map((video) => (
                <li key={video.id}>
                  <CardLink href={`/videos/${video.id}`}>
                    <p className="text-metadata tracking-widest text-ink-muted uppercase">
                      {t(`video.levels.${video.level}`)} ·{" "}
                      {t(`video.categories.${video.category}`)}
                    </p>
                    <p lang="en" className="mt-4 font-display text-h3">
                      {video.title}
                    </p>
                    <VideoProgressLabel videoId={video.id} />
                    <p className="mt-4 flex justify-between gap-4 text-supporting text-ink-muted">
                      <span>
                        {video.source} ·{" "}
                        {t("library.sentences", {
                          count: video.sentences.length,
                        })}
                      </span>
                      <span aria-hidden="true">→</span>
                    </p>
                  </CardLink>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </section>
    </main>
  );
}

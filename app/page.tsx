import { useTranslations } from "next-intl";
import { CardLink } from "@/components/CardLink";
import { VideoProgressLabel } from "@/components/VideoProgressLabel";
import { getAllVideos } from "@/lib/video-library";

export default function Home() {
  const t = useTranslations();
  const videos = getAllVideos();

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-16 split:px-6">
      <h1 className="font-display text-hero">{t("common.appName")}</h1>
      <p className="mt-4 font-display text-h3">{t("home.tagline")}</p>

      <section className="mt-16">
        <h2 className="font-display text-h2">{t("library.title")}</h2>
        <p className="mt-2 text-ink-muted">{t("library.intro")}</p>
        <ul className="mt-8 grid gap-6 split:grid-cols-2">
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
                    {t("library.sentences", { count: video.sentences.length })}
                  </span>
                  <span aria-hidden="true">→</span>
                </p>
              </CardLink>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

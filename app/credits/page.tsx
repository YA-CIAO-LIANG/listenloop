import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { VideoAttribution } from "@/components/VideoAttribution";
import { getAllVideos } from "@/lib/video-library";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("credits");
  return { title: t("title") };
}

/** Every video ListenLoop uses, credited as its license asks. */
export default async function CreditsPage() {
  const t = await getTranslations("credits");

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>

      <section className="mt-16">
        <h2 className="mb-6 font-display text-h2">{t("videos")}</h2>
        <ul className="space-y-8">
          {getAllVideos().map((video) => (
            <li key={video.id} className="border-t border-line pt-6">
              <h3 lang="en" className="mb-4 font-display text-h3">
                {video.title}
              </h3>
              <VideoAttribution attribution={video.attribution} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { VideoAttribution } from "@/components/VideoAttribution";
import { fishCatalog } from "@/data/fish";
import { getAllVideos } from "@/lib/video-library";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("credits");
  return { title: t("title") };
}

const linkClassName =
  "text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink";

/** Every creator whose work ListenLoop uses, as CC BY asks (TASL + changes). */
export default async function CreditsPage() {
  const t = await getTranslations("credits");
  const tFish = await getTranslations("fish");

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

      <section className="mt-16">
        <h2 className="mb-6 font-display text-h2">{t("fish")}</h2>
        <ul className="space-y-8">
          {fishCatalog.map((fish) => (
            <li
              key={fish.id}
              id={fish.id}
              className="scroll-mt-8 space-y-3 border-t border-line pt-6"
            >
              <h3 className="font-display text-h3">
                {tFish(`${fish.id}.name` as "snail.name")}
              </h3>
              <ul className="space-y-2 text-supporting">
                {fish.credits.map((credit, index) => (
                  <li key={credit.url}>
                    {index > 0 && (
                      <span className="text-ink-muted">{t("madeFrom")} </span>
                    )}
                    <span lang="en">
                      “{credit.title}” by {credit.author}
                    </span>
                    {" · "}
                    <a href={credit.licenseUrl} className={linkClassName}>
                      {credit.license}
                    </a>
                    {" · "}
                    <a href={credit.url} className={linkClassName}>
                      {t("source")}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="text-supporting text-ink-muted">
                {t("changes")}：<span lang="en">{fish.changes}</span>
              </p>
              <p className="text-metadata text-ink-muted">
                {t("verified", { date: fish.verifiedAt })}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MyPractices } from "@/components/MyPractices";
import { getAllVideos } from "@/lib/video-library";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("practices");
  return { title: t("title") };
}

/** Every video the learner has started, with its progress. */
export default async function PracticesPage() {
  const t = await getTranslations("practices");
  const titles = Object.fromEntries(
    getAllVideos().map((video) => [video.id, video.title]),
  );

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      <MyPractices titles={titles} />
    </main>
  );
}

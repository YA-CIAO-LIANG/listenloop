import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { VideoAttribution } from "@/components/VideoAttribution";
import { getVideo } from "@/lib/video-library";
import { TimingTool } from "./TimingTool";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("timing");
  // Internal tool: keep it out of search results and navigation.
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function TimingPage({
  params,
}: PageProps<"/videos/[id]/timing">) {
  const video = getVideo((await params).id);
  if (!video) notFound();
  const t = await getTranslations("timing");

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">
        {t("title")}
        <span lang="en"> · {video.title}</span>
      </h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      <TimingTool video={video} />
      <VideoAttribution
        attribution={video.attribution}
        className="mt-12 border-t border-line pt-6"
      />
    </main>
  );
}

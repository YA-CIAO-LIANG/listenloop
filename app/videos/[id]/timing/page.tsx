import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { VideoAttribution } from "@/components/VideoAttribution";
import { getVideoIncludingDrafts } from "@/lib/video-library";
import { TimingTool } from "./TimingTool";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("timing");
  // Internal tool: keep it out of search results and navigation.
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function TimingPage({
  params,
}: PageProps<"/videos/[id]/timing">) {
  // Drafts open here (and nowhere else) so their timestamps can be tuned.
  const video = getVideoIncludingDrafts((await params).id);
  if (!video) notFound();
  const t = await getTranslations("timing");
  // An excerpt copies its source's times (npm run video:sync): tune there.
  const source =
    video.excerptOf && getVideoIncludingDrafts(video.excerptOf.video);

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <h1 className="font-display text-h1">
        {t("title")}
        <span lang="en"> · {video.title}</span>
      </h1>
      {source ? (
        <div className="mt-4 max-w-reading space-y-4">
          <p className="text-ink-muted">{t("excerpt")}</p>
          <Link
            href={`/videos/${source.id}/timing`}
            className="inline-block text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
          >
            {t("excerptLink")}
            <span lang="en"> {source.title}</span> →
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
          <TimingTool video={video} />
        </>
      )}
      <VideoAttribution
        attribution={video.attribution}
        className="mt-12 border-t border-line pt-6"
      />
    </main>
  );
}

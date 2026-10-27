import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DayOneStatus } from "@/components/DayOneStatus";
import { VideoAttribution } from "@/components/VideoAttribution";
import { getVideo } from "@/lib/video-library";
import { VideoPlayerPanel } from "./VideoPlayerPanel";

export async function generateMetadata({
  params,
}: PageProps<"/videos/[id]">): Promise<Metadata> {
  const video = getVideo((await params).id);
  return video ? { title: video.title } : {};
}

export default async function VideoPage({ params }: PageProps<"/videos/[id]">) {
  const video = getVideo((await params).id);
  if (!video) notFound();
  const t = await getTranslations("video");

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <Link href="/" className="text-supporting text-ink-muted hover:text-ink">
        <span aria-hidden="true">← </span>
        {t("back")}
      </Link>

      <p className="mt-8 text-metadata tracking-widest text-ink-muted uppercase">
        {t(`levels.${video.level}`)} · {t(`categories.${video.category}`)}
      </p>
      <h1 lang="en" className="mt-2 font-display text-h1">
        {video.title}
      </h1>

      <div className="mt-8">
        <VideoPlayerPanel youtubeId={video.youtubeId} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <DayOneStatus videoId={video.id} />
        <p className="text-ink-muted">
          {t("excerpt", { count: video.sentences.length })}
        </p>
      </div>

      <VideoAttribution
        attribution={video.attribution}
        className="mt-12 border-t border-line pt-6"
      />
    </main>
  );
}

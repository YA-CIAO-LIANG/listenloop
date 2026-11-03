import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CycleStatus } from "@/components/CycleStatus";
import { VideoAttribution } from "@/components/VideoAttribution";
import { getPracticeMaterial } from "@/auth/practice-material";
import { titleLang } from "@/lib/practice-material";
import { getVideo } from "@/lib/video-library";
import { VideoPlayerPanel } from "./VideoPlayerPanel";

export async function generateMetadata({
  params,
}: PageProps<"/videos/[id]">): Promise<Metadata> {
  const material = await getPracticeMaterial((await params).id);
  return material ? { title: material.title } : {};
}

export default async function VideoPage({ params }: PageProps<"/videos/[id]">) {
  const { id } = await params;
  const material = await getPracticeMaterial(id);
  if (!material) notFound();
  // Built-in videos have a level, category, player, and credit; created
  // practices are audio only.
  const video = getVideo(id);
  const t = await getTranslations("video");

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <Link
        href={video ? "/" : "/create"}
        className="text-supporting text-ink-muted hover:text-ink"
      >
        <span aria-hidden="true">← </span>
        {t(video ? "back" : "backToCreate")}
      </Link>

      <p className="mt-8 text-metadata tracking-widest text-ink-muted uppercase">
        {video
          ? `${t(`levels.${video.level}`)} · ${t(`categories.${video.category}`)}`
          : t("custom")}
      </p>
      <h1 lang={titleLang(material.id)} className="mt-2 font-display text-h1">
        {material.title}
      </h1>

      {video && (
        <div className="mt-8">
          <VideoPlayerPanel youtubeId={video.youtubeId} />
        </div>
      )}

      <p className="mt-4 text-ink-muted">
        {t(video ? "excerpt" : "customSentences", {
          count: material.sentences.length,
        })}
      </p>

      <div className="mt-8">
        <CycleStatus videoId={material.id} />
      </div>

      {video && (
        <VideoAttribution
          attribution={video.attribution}
          className="mt-12 border-t border-line pt-6"
        />
      )}
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DictationSession } from "@/components/DictationSession";
import { VideoAttribution } from "@/components/VideoAttribution";
import { getVideo } from "@/lib/video-library";

// Only Day 1 exists so far; shadowing (Days 2–6) and Day 7 come in later PRs,
// along with the unlock rules.
const AVAILABLE_DAYS = ["1"];

export async function generateMetadata({
  params,
}: PageProps<"/videos/[id]/day/[day]">): Promise<Metadata> {
  const { id } = await params;
  const video = getVideo(id);
  const t = await getTranslations("dictation");
  return video ? { title: `${t("title")} · ${video.title}` } : {};
}

export default async function DayPage({
  params,
}: PageProps<"/videos/[id]/day/[day]">) {
  const { id, day } = await params;
  const video = getVideo(id);
  if (!video || !AVAILABLE_DAYS.includes(day)) notFound();
  const t = await getTranslations("dictation");

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <Link
        href={`/videos/${video.id}`}
        className="text-supporting text-ink-muted hover:text-ink"
      >
        <span aria-hidden="true">← </span>
        <span lang="en">{video.title}</span>
      </Link>
      <h1 className="mt-6 font-display text-h1">{t("title")}</h1>
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>

      <DictationSession video={video} day={1} />

      <VideoAttribution
        attribution={video.attribution}
        className="mt-12 border-t border-line pt-6"
      />
    </main>
  );
}

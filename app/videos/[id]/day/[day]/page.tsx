import type { Metadata } from "next";
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
  searchParams,
}: PageProps<"/videos/[id]/day/[day]">) {
  const { id, day } = await params;
  // ?retry=1 (from the video page) jumps straight into extra practice.
  const startInRetry = (await searchParams).retry === "1";
  const video = getVideo(id);
  if (!video || !AVAILABLE_DAYS.includes(day)) notFound();
  const t = await getTranslations("dictation");

  // The practice area comes first so a whole sentence fits on one screen;
  // the intro and credits sit below it.
  return (
    <main className="w-full flex-1 px-4 py-6 split:px-6">
      <DictationSession
        video={video}
        day={1}
        title={t("title")}
        startInRetry={startInRetry}
      >
        <div className="practice-column mt-12 space-y-12">
          <p className="text-ink-muted">{t("intro")}</p>
          <VideoAttribution
            attribution={video.attribution}
            className="border-t border-line pt-6"
          />
        </div>
      </DictationSession>
    </main>
  );
}

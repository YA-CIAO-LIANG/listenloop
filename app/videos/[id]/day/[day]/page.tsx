import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DictationSession } from "@/components/DictationSession";
import { ShadowingSession } from "@/components/ShadowingSession";
import { VideoAttribution } from "@/components/VideoAttribution";
import { isShadowingDay } from "@/lib/shadowing";
import { getVideo } from "@/lib/video-library";

// Day 1 is dictation and Days 2–6 are shadowing. Day 7 and the unlock rules
// come in a later PR, so every available day can be opened directly for now.
function parseDay(day: string): number | null {
  return /^[1-6]$/.test(day) ? Number(day) : null;
}

async function dayTitle(day: number) {
  if (day === 1) return (await getTranslations("dictation"))("title");
  return (await getTranslations("shadowing"))("title", { day });
}

export async function generateMetadata({
  params,
}: PageProps<"/videos/[id]/day/[day]">): Promise<Metadata> {
  const { id, day } = await params;
  const video = getVideo(id);
  const n = parseDay(day);
  return video && n ? { title: `${await dayTitle(n)} · ${video.title}` } : {};
}

export default async function DayPage({
  params,
  searchParams,
}: PageProps<"/videos/[id]/day/[day]">) {
  const { id, day } = await params;
  // ?retry=1 (from the video page) jumps straight into extra practice.
  const startInRetry = (await searchParams).retry === "1";
  const video = getVideo(id);
  const n = parseDay(day);
  if (!video || !n) notFound();
  const t = await getTranslations(n === 1 ? "dictation" : "shadowing");
  const title = await dayTitle(n);

  // The practice area comes first so a whole sentence fits on one screen;
  // the intro and credits sit below it.
  const below = (
    <div className="practice-column mt-12 space-y-12">
      <p className="text-ink-muted">{t("intro")}</p>
      <VideoAttribution
        attribution={video.attribution}
        className="border-t border-line pt-6"
      />
    </div>
  );

  return (
    <main className="w-full flex-1 px-4 py-6 split:px-6">
      {isShadowingDay(n) ? (
        <ShadowingSession
          video={video}
          day={n}
          title={title}
          startInRetry={startInRetry}
        >
          {below}
        </ShadowingSession>
      ) : (
        <DictationSession
          video={video}
          day={1}
          title={title}
          startInRetry={startInRetry}
        >
          {below}
        </DictationSession>
      )}
    </main>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DayGate } from "@/components/DayGate";
import { DictationSession } from "@/components/DictationSession";
import { ShadowingSession } from "@/components/ShadowingSession";
import { VersionGate } from "@/components/VersionGate";
import { VideoAttribution } from "@/components/VideoAttribution";
import type { CycleDay } from "@/lib/cycle";
import { isShadowingDay } from "@/lib/shadowing";
import { getPracticeState } from "@/auth/practice-material";
import { PracticePreparing } from "@/components/PracticePreparing";
import {
  parseVersionParam,
  practiceRobots,
  preparingMetadata,
} from "@/lib/practice-material";

// Day 1 is dictation, Days 2–6 are shadowing, Day 7 is re-dictation.
// DayGate keeps days closed until they unlock.
function parseDay(day: string): CycleDay | null {
  return /^[1-7]$/.test(day) ? (Number(day) as CycleDay) : null;
}

/** Message group for a day's intro and title. */
function dayMessages(day: CycleDay) {
  if (day === 1) return "dictation" as const;
  if (day === 7) return "redictation" as const;
  return "shadowing" as const;
}

async function dayTitle(day: CycleDay) {
  if (isShadowingDay(day)) {
    return (await getTranslations("shadowing"))("title", { day });
  }
  return (await getTranslations(dayMessages(day)))("title");
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/videos/[id]/day/[day]">): Promise<Metadata> {
  const { id, day } = await params;
  const n = parseDay(day);
  const version = parseVersionParam((await searchParams).v);
  const state = n ? await getPracticeState(id, version) : null;
  if (state?.status === "preparing") return preparingMetadata(state);
  return state && n
    ? {
        title: `${await dayTitle(n)} · ${state.material.title}`,
        ...practiceRobots(state.material),
      }
    : {};
}

export default async function DayPage({
  params,
  searchParams,
}: PageProps<"/videos/[id]/day/[day]">) {
  const { id, day } = await params;
  const query = await searchParams;
  // ?retry=1 (from the video page) jumps straight into extra practice.
  const startInRetry = query.retry === "1";
  // ?v= keeps a week on the version it started with (D44, VersionGate).
  const version = parseVersionParam(query.v);
  const n = parseDay(day);
  const state = n ? await getPracticeState(id, version) : null;
  if (state?.status === "preparing") {
    return (
      <PracticePreparing
        practice={state}
        practiceHref={`/videos/${id}/day/${n}`}
      />
    );
  }
  if (!state || !n) notFound();
  const video = state.material;
  const t = await getTranslations(dayMessages(n));
  const title = await dayTitle(n);

  // The practice area comes first so a whole sentence fits on one screen;
  // the intro and credits sit below it.
  const below = (
    <div className="practice-column mt-12 space-y-12">
      <p className="text-ink-muted">{t("intro")}</p>
      {video.attribution && (
        <VideoAttribution
          attribution={video.attribution}
          className="border-t border-line pt-6"
        />
      )}
    </div>
  );

  return (
    <main className="w-full flex-1 px-4 py-6 split:px-6">
      <VersionGate videoId={video.id} version={video.version}>
        <DayGate videoId={video.id} videoTitle={video.title} day={n}>
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
              day={n === 7 ? 7 : 1}
              title={title}
              startInRetry={startInRetry}
            >
              {below}
            </DictationSession>
          )}
        </DayGate>
      </VersionGate>
    </main>
  );
}

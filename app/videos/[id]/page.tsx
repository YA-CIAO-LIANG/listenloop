import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CycleStatus } from "@/components/CycleStatus";
import { VideoAttribution } from "@/components/VideoAttribution";
import { getPracticeState } from "@/auth/practice-material";
import { getSignedInUser } from "@/auth/session";
import { PracticePreparing } from "@/components/PracticePreparing";
import { ReportPractice } from "@/components/ReportPractice";
import {
  practiceRobots,
  preparingMetadata,
  titleLang,
} from "@/lib/practice-material";
import { getVideo } from "@/lib/video-library";
import { VideoPlayerPanel } from "./VideoPlayerPanel";

export async function generateMetadata({
  params,
}: PageProps<"/videos/[id]">): Promise<Metadata> {
  const state = await getPracticeState((await params).id);
  if (state?.status === "preparing") return preparingMetadata(state);
  return state
    ? { title: state.material.title, ...practiceRobots(state.material) }
    : {};
}

export default async function VideoPage({ params }: PageProps<"/videos/[id]">) {
  const { id } = await params;
  const state = await getPracticeState(id);
  if (state?.status === "preparing") {
    return (
      <PracticePreparing practice={state} practiceHref={`/videos/${id}`} />
    );
  }
  if (!state) notFound();
  const material = state.material;
  // Built-in videos have a level, category, player, and credit; created
  // practices are audio only.
  const video = getVideo(id);
  const t = await getTranslations("video");

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <Link
        href={video ? "/" : material.mine ? "/materials" : "/explore"}
        className="text-supporting text-ink-muted hover:text-ink"
      >
        <span aria-hidden="true">← </span>
        {t(video ? "back" : material.mine ? "backToCreate" : "backToExplore")}
      </Link>

      <p className="mt-8 text-metadata tracking-widest text-ink-muted uppercase">
        {video
          ? `${t(`levels.${video.level}`)} · ${t(`categories.${video.category}`)}`
          : t(material.mine ? "custom" : "shared")}
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
      {!video && !material.mine && (
        <div className="mt-12 border-t border-line pt-6">
          <ReportPractice
            practiceId={material.id}
            signedIn={(await getSignedInUser()) !== null}
          />
        </div>
      )}
    </main>
  );
}

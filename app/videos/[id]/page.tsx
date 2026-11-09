import type { Metadata } from "next";
import { oneLineTitle } from "@/lib/titles";
import { MaterialTitle } from "@/components/MaterialTitle";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CycleStatus } from "@/components/CycleStatus";
import { PassRulesSettings } from "@/components/PassRulesSettings";
import { VideoAttribution } from "@/components/VideoAttribution";
import { getPracticeState } from "@/auth/practice-material";
import { getSignedInUser } from "@/auth/session";
import { PracticePreparing } from "@/components/PracticePreparing";
import { SharedPreviewPage } from "@/components/SharedPreviewPage";
import { ReportPractice } from "@/components/ReportPractice";
import { practiceRobots, preparingMetadata } from "@/lib/practice-material";
import { getVideo } from "@/lib/video-library";
import { VideoPlayerPanel } from "./VideoPlayerPanel";

export async function generateMetadata({
  params,
}: PageProps<"/videos/[id]">): Promise<Metadata> {
  const state = await getPracticeState((await params).id);
  if (state?.status === "preparing") return preparingMetadata(state);
  if (state?.status === "preview") {
    return {
      title: oneLineTitle({
        en: state.preview.title,
        zh: state.preview.titleZh,
      }),
      robots: { index: false, follow: false },
    };
  }
  return state
    ? {
        title: oneLineTitle({
          en: state.material.title,
          zh: state.material.titleZh ?? null,
        }),
        ...practiceRobots(state.material),
      }
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
  if (state?.status === "preview") {
    return <SharedPreviewPage preview={state.preview} />;
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
        className="tap text-supporting text-ink-muted hover:text-ink"
      >
        <span aria-hidden="true">← </span>
        {t(video ? "back" : material.mine ? "backToCreate" : "backToExplore")}
      </Link>

      <p className="mt-8 text-metadata tracking-widest text-ink-muted uppercase">
        {video
          ? `${t(`levels.${video.level}`)} · ${t(`categories.${video.category}`)}`
          : t(material.mine ? "custom" : "shared")}
      </p>
      <MaterialTitle
        as="h1"
        titles={{ en: material.title, zh: material.titleZh ?? null }}
        className="mt-2 font-display text-h1"
        zhClassName="mt-2 block font-display text-h2 text-ink-muted"
      />
      {material.subtitle && (
        <p lang="zh-Hant" className="mt-3 max-w-reading text-ink-muted">
          {material.subtitle}
        </p>
      )}

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
      <div className="mt-12 border-t border-line pt-6">
        <PassRulesSettings videoId={material.id} />
      </div>

      {video && (
        <VideoAttribution
          attribution={video.attribution}
          className="mt-12 border-t border-line pt-6"
        />
      )}
      {/* A YouTube practice credits its video (D97). */}
      {!video && material.attribution && (
        <VideoAttribution
          attribution={material.attribution}
          className="mt-12 border-t border-line pt-6"
        />
      )}
      {/* A news material says what it was rewritten from (D100). */}
      {material.rewrittenFrom && (
        <p className="mt-12 border-t border-line pt-6 text-supporting text-ink-muted">
          {t.rich("rewrittenFrom", {
            source: material.rewrittenFrom.name,
            link: (chunks) => (
              <a
                href={material.rewrittenFrom!.url}
                lang="en"
                className="text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
              >
                {chunks}
              </a>
            ),
            title: material.rewrittenFrom.title,
          })}
        </p>
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

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
import {
  isIndexableMaterial,
  practiceRobots,
  preparingMetadata,
  type PracticeMaterial,
} from "@/lib/practice-material";
import { getVideo } from "@/lib/video-library";
import { getLibraryItems } from "@/auth/library";
import { JsonLd } from "@/components/JsonLd";
import { RelatedArticles } from "@/components/RelatedArticles";
import { seoFor } from "@/i18n/metadata";
import { postsForTopic } from "@/lib/blog";
import { defaultLocale } from "@/lib/i18n/config";
import { isLearnCategory, learnPath } from "@/lib/learn";
import { localizedUrl } from "@/lib/seo";
import { breadcrumbList, learningResource } from "@/lib/structured-data";
import type { Video } from "@/lib/videos";
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
  if (!state) return {};
  const material = state.material;
  const title = oneLineTitle({
    en: material.title,
    zh: material.titleZh ?? null,
  });
  if (!isIndexableMaterial(material)) {
    return { title, ...practiceRobots(material) };
  }
  // Ours to index (D167): its own description, canonical, hreflang; the
  // share image is ./opengraph-image.tsx.
  const t = await getTranslations("video");
  return seoFor({
    path: `/videos/${material.id}`,
    title,
    description: t("seoDescription", {
      title,
      count: material.sentences.length,
    }),
  });
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
      {/* Official materials go back to the official library, not to
          shared materials, which never list them (D170). */}
      <Link
        href={
          video
            ? "/"
            : material.mine
              ? "/materials"
              : material.official
                ? "/#library"
                : "/explore"
        }
        className="tap text-supporting text-ink-muted hover:text-ink"
      >
        <span aria-hidden="true">← </span>
        {t(
          video
            ? "back"
            : material.mine
              ? "backToCreate"
              : material.official
                ? "backToLibrary"
                : "backToExplore",
        )}
      </Link>

      <p className="mt-8 text-metadata tracking-widest text-ink-muted uppercase">
        {video
          ? `${t(`levels.${video.level}`)} · ${t(`categories.${video.category}`)}`
          : t(
              material.mine
                ? "custom"
                : material.official
                  ? "officialMaterial"
                  : "shared",
            )}
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
      {/* A news material says what it was rewritten from (D100); a
          classic, the work it's from (D213). */}
      {material.rewrittenFrom && (
        <p className="mt-12 border-t border-line pt-6 text-supporting text-ink-muted">
          {t.rich(
            material.rewrittenFrom.classic ? "classicSource" : "rewrittenFrom",
            {
              source: material.rewrittenFrom.name,
              link: (chunks) => (
                <a
                  href={material.rewrittenFrom!.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  lang="en"
                  className="text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
                >
                  {chunks}
                </a>
              ),
              title: material.rewrittenFrom.title,
            },
          )}
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
      {isIndexableMaterial(material) && (
        <MaterialSeo material={material} video={video} />
      )}
    </main>
  );
}

/**
 * For an indexable material (D167): articles about its topic (links run
 * both ways with the articles), and its structured data.
 */
async function MaterialSeo({
  material,
  video,
}: {
  material: PracticeMaterial;
  video: Video | undefined;
}) {
  const [tCommon, tLearn, tNames, items] = await Promise.all([
    getTranslations("common"),
    getTranslations("learn"),
    getTranslations("categories.names"),
    getLibraryItems(),
  ]);
  const item = items.find((i) => i.id === material.id);
  const topic = isLearnCategory(item?.category) ? item.category : null;
  const url = localizedUrl(`/videos/${material.id}`, defaultLocale);
  const name = oneLineTitle({
    en: material.title,
    zh: material.titleZh ?? null,
  });
  return (
    <>
      <RelatedArticles
        posts={postsForTopic(topic)}
        className="mt-12 border-t border-line pt-6"
      />
      <JsonLd
        data={learningResource({
          name,
          description: material.subtitle,
          url,
          provider: tCommon("appName"),
          level: item?.level ?? video?.level ?? null,
          seconds: item?.seconds,
          license: video?.attribution.licenseUrl ?? null,
          sourceUrl: video?.attribution.sourceUrl ?? null,
        })}
      />
      <JsonLd
        data={breadcrumbList([
          { name: tCommon("appName"), url: localizedUrl("/", defaultLocale) },
          ...(topic
            ? [
                {
                  name: tLearn("pageTitle", { name: tNames(topic) }),
                  url: localizedUrl(learnPath(topic), defaultLocale),
                },
              ]
            : []),
          { name, url },
        ])}
      />
    </>
  );
}

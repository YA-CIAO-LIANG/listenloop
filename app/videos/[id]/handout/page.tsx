import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Handout } from "@/components/Handout";
import { HandoutGate } from "@/components/HandoutGate";
import { getPracticeState } from "@/auth/practice-material";
import { PracticePreparing } from "@/components/PracticePreparing";
import { VersionGate } from "@/components/VersionGate";
import {
  parseVersionParam,
  practiceRobots,
  preparingMetadata,
  titleLang,
} from "@/lib/practice-material";

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/videos/[id]/handout">): Promise<Metadata> {
  const state = await getPracticeState(
    (await params).id,
    parseVersionParam((await searchParams).v),
  );
  if (state?.status === "preparing") return preparingMetadata(state);
  const t = await getTranslations("handout");
  return state
    ? {
        title: `${state.material.title} · ${t("title")}`,
        ...practiceRobots(state.material),
      }
    : {};
}

export default async function HandoutPage({
  params,
  searchParams,
}: PageProps<"/videos/[id]/handout">) {
  const { id } = await params;
  // ?v= shows the version the learner's week uses (D44, VersionGate).
  const state = await getPracticeState(
    id,
    parseVersionParam((await searchParams).v),
  );
  if (state?.status === "preparing") {
    return (
      <PracticePreparing
        practice={state}
        practiceHref={`/videos/${id}/handout`}
      />
    );
  }
  if (!state) notFound();
  const video = state.material;
  const t = await getTranslations("handout");

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6 print:max-w-none print:p-0">
      <Link
        href={`/videos/${video.id}`}
        className="text-supporting text-ink-muted hover:text-ink print:hidden"
      >
        <span aria-hidden="true">← </span>
        <span lang={titleLang(video.id)}>{video.title}</span>
      </Link>
      <h1 className="mt-6 font-display text-h1 print:mt-0">
        <span lang={titleLang(video.id)}>{video.title}</span> · {t("title")}
      </h1>
      <div className="mt-6">
        <VersionGate videoId={video.id} version={video.version}>
          <HandoutGate videoId={video.id}>
            <Handout video={video} />
          </HandoutGate>
        </VersionGate>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import { oneLineTitle } from "@/lib/titles";
import { MaterialTitle } from "@/components/MaterialTitle";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
  if (state?.status === "preview") return {};
  const t = await getTranslations("handout");
  return state
    ? {
        title: `${oneLineTitle({ en: state.material.title, zh: state.material.titleZh ?? null })} · ${t("title")}`,
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
  // Not theirs to practice (D106): the preview, with what it'd take.
  if (state?.status === "preview") redirect(`/videos/${id}`);
  if (!state) notFound();
  const video = state.material;
  const t = await getTranslations("handout");

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6 print:max-w-none print:p-0">
      <Link
        href={`/videos/${video.id}`}
        className="tap text-supporting text-ink-muted hover:text-ink print:hidden"
      >
        <span aria-hidden="true">← </span>
        {oneLineTitle({ en: video.title, zh: video.titleZh ?? null })}
      </Link>
      <p className="mt-6 text-metadata tracking-widest text-ink-muted uppercase print:mt-0">
        {t("title")}
      </p>
      {/* English, then Chinese, in print too (D83). */}
      <MaterialTitle
        as="h1"
        titles={{ en: video.title, zh: video.titleZh ?? null }}
        className="mt-2 font-display text-h1"
        zhClassName="mt-2 block font-display text-h2 text-ink-muted"
      />
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

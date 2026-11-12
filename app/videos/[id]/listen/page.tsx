import type { Metadata } from "next";
import { oneLineTitle } from "@/lib/titles";
import { MaterialTitle } from "@/components/MaterialTitle";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ListenSession } from "@/components/ListenSession";
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
}: PageProps<"/videos/[id]/listen">): Promise<Metadata> {
  const state = await getPracticeState(
    (await params).id,
    parseVersionParam((await searchParams).v),
  );
  if (state?.status === "preparing") return preparingMetadata(state);
  if (state?.status === "preview") return {};
  const t = await getTranslations("listen");
  return state
    ? {
        title: `${oneLineTitle({ en: state.material.title, zh: state.material.titleZh ?? null })} · ${t("title")}`,
        ...practiceRobots(state.material),
      }
    : {};
}

/**
 * Listening mode (D135): the whole text without a test, once Day 1 is
 * done (the same rule as the handout).
 */
export default async function ListenPage({
  params,
  searchParams,
}: PageProps<"/videos/[id]/listen">) {
  const { id } = await params;
  const query = await searchParams;
  // ?v= shows the version the learner's week uses (D44, VersionGate).
  const state = await getPracticeState(id, parseVersionParam(query.v));
  if (state?.status === "preparing") {
    return (
      <PracticePreparing
        practice={state}
        practiceHref={`/videos/${id}/listen`}
      />
    );
  }
  // Not theirs to practice (D106): the preview, with what it'd take.
  if (state?.status === "preview") redirect(`/videos/${id}`);
  if (!state) notFound();
  const video = state.material;
  const t = await getTranslations("listen");

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-4 py-12 split:px-6">
      <Link
        href={`/videos/${video.id}`}
        className="tap text-supporting text-ink-muted hover:text-ink"
      >
        <span aria-hidden="true">← </span>
        {oneLineTitle({ en: video.title, zh: video.titleZh ?? null })}
      </Link>
      <p className="mt-6 text-metadata tracking-widest text-ink-muted uppercase">
        {t("title")}
      </p>
      <MaterialTitle
        as="h1"
        titles={{ en: video.title, zh: video.titleZh ?? null }}
        className="mt-2 font-display text-h1"
        zhClassName="mt-2 block font-display text-h2 text-ink-muted"
      />
      <p className="mt-4 max-w-reading text-ink-muted">{t("intro")}</p>
      <div className="mt-8 max-w-practice">
        <VersionGate videoId={video.id} version={video.version}>
          <ListenSession
            video={video}
            start={Number((Array.isArray(query.s) ? query.s[0] : query.s) ?? 0)}
          />
        </VersionGate>
      </div>
    </main>
  );
}

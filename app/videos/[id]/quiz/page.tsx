import type { Metadata } from "next";
import { oneLineTitle } from "@/lib/titles";
import { MaterialTitle } from "@/components/MaterialTitle";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { VocabQuiz } from "@/components/VocabQuiz";
import { getAllVideos } from "@/lib/video-library";
import {
  isQuizzable,
  QUIZ,
  quizCandidates,
  type PoolWord,
} from "@/lib/vocab-quiz";
import { getPracticeState } from "@/auth/practice-material";
import { PracticePreparing } from "@/components/PracticePreparing";
import { VersionGate } from "@/components/VersionGate";
import { wordVoice } from "@/lib/word-audio";
import {
  parseVersionParam,
  practiceRobots,
  preparingMetadata,
} from "@/lib/practice-material";

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/videos/[id]/quiz">): Promise<Metadata> {
  const state = await getPracticeState(
    (await params).id,
    parseVersionParam((await searchParams).v),
  );
  if (state?.status === "preparing") return preparingMetadata(state);
  if (state?.status === "preview") return {};
  const t = await getTranslations("quiz");
  return state
    ? {
        title: `${oneLineTitle({ en: state.material.title, zh: state.material.titleZh ?? null })} · ${t("title")}`,
        ...practiceRobots(state.material),
      }
    : {};
}

/**
 * Other materials' words, for the quiz's wrong answers (D136): built-in
 * videos' notes, read here so they never go to the browser whole; at
 * most QUIZ.poolPerPos per part of speech.
 */
function otherWords(exceptId: string): PoolWord[] {
  const perPos = new Map<string, number>();
  return getAllVideos()
    .filter((video) => video.id !== exceptId)
    .flatMap((video) => video.vocab)
    .filter((item) => isQuizzable(item.word) && item.zh.trim())
    .flatMap((item) => {
      const seen = perPos.get(item.pos) ?? 0;
      if (seen >= QUIZ.poolPerPos) return [];
      perPos.set(item.pos, seen + 1);
      return [{ word: item.word, pos: item.pos, zh: item.zh }];
    });
}

/**
 * The vocabulary quiz (D136), after Day 1's or Day 7's dictation
 * (?day=7): spell each word from its sound, then choose its Chinese.
 */
export default async function QuizPage({
  params,
  searchParams,
}: PageProps<"/videos/[id]/quiz">) {
  const { id } = await params;
  // ?v= shows the version the learner's week uses (D44, VersionGate).
  const state = await getPracticeState(
    id,
    parseVersionParam((await searchParams).v),
  );
  if (state?.status === "preparing") {
    return (
      <PracticePreparing practice={state} practiceHref={`/videos/${id}/quiz`} />
    );
  }
  // Not theirs to practice (D106): the preview, with what it'd take.
  if (state?.status === "preview") redirect(`/videos/${id}`);
  if (!state) notFound();
  const video = state.material;
  const day = (await searchParams).day === "7" ? 7 : 1;
  const t = await getTranslations("quiz");

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
          <VocabQuiz
            video={video}
            day={day}
            candidates={quizCandidates(video)}
            others={otherWords(video.id)}
            accent={wordVoice(video).accent}
          />
        </VersionGate>
      </div>
    </main>
  );
}

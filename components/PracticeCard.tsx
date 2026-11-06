"use client";

import { useTranslations } from "next-intl";
import { parseVoiceId } from "@/lib/ai/types";
import type { PublicPracticeSummary } from "@/lib/custom-practice/explore";
import { CardLink } from "./CardLink";
import { VideoProgressLabel } from "./VideoProgressLabel";

/**
 * A created practice's card (public practices on /explore, official ones
 * in the library, D30, D46): its source language and voice, title, the
 * viewer's progress, and its length in sentences.
 */
export function PracticeCard({
  practice,
}: {
  practice: PublicPracticeSummary;
}) {
  const t = useTranslations("explore");
  const tVoice = useTranslations("voicePicker");
  const parsed = practice.voice ? parseVoiceId(practice.voice) : null;
  const voice = parsed
    ? tVoice("voiceName", {
        accent: tVoice(`accents.${parsed.accent}`),
        gender: tVoice(`genders.${parsed.gender}`),
      })
    : null;
  return (
    <CardLink href={`/videos/${practice.id}`}>
      <p className="text-metadata tracking-widest text-ink-muted uppercase">
        {t(`source.${practice.sourceLanguage}`)}
        {voice && ` · ${voice}`}
      </p>
      <p className="mt-4 font-display text-h3">{practice.title}</p>
      <VideoProgressLabel videoId={practice.id} />
      <p className="mt-4 flex justify-between gap-4 text-supporting text-ink-muted">
        <span>
          {t("sentences", { count: practice.sentenceCount })}
          {practice.mine && ` · ${t("mine")}`}
        </span>
        <span aria-hidden="true">→</span>
      </p>
    </CardLink>
  );
}

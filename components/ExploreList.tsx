"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { parseVoiceId } from "@/lib/ai/types";
import {
  filterPublicPractices,
  NO_FILTER,
  SENTENCE_BUCKETS,
  sentenceBucket,
  type ExploreFilter,
  type PublicPracticeSummary,
  type SentenceBucketId,
} from "@/lib/custom-practice/explore";
import type { TextSourceLanguage } from "@/lib/custom-practice/split";
import { Button } from "./Button";
import { CardLink } from "./CardLink";
import { FilterChip } from "./FilterChip";
import { VideoProgressLabel } from "./VideoProgressLabel";

const LANGUAGES: readonly TextSourceLanguage[] = ["en", "zh"];

/** Adds `value` if it's off, removes it if it's on, keeping `order`. */
function toggle<T>(list: readonly T[], value: T, order: readonly T[]): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : order.filter((v) => v === value || list.includes(v));
}

/**
 * Public practices (D30): a title search, source-language and length
 * filters (several can be on; none means all), and a card for each match,
 * newest first.
 */
export function ExploreList({
  practices,
}: {
  practices: readonly PublicPracticeSummary[];
}) {
  const t = useTranslations("explore");
  const tVoice = useTranslations("voicePicker");
  const ids = useId();
  const [filter, setFilter] = useState<ExploreFilter>(NO_FILTER);

  if (practices.length === 0) {
    return <p className="mt-8 text-ink-muted">{t("none")}</p>;
  }

  const shown = filterPublicPractices(practices, filter);
  const filtering =
    filter.query.trim() !== "" ||
    filter.languages.length > 0 ||
    filter.lengths.length > 0;
  const count = <K,>(match: (p: PublicPracticeSummary) => K, key: K) =>
    practices.filter((p) => match(p) === key).length;
  const voiceName = (voice: string | null) => {
    const parsed = voice ? parseVoiceId(voice) : null;
    return parsed
      ? tVoice("voiceName", {
          accent: tVoice(`accents.${parsed.accent}`),
          gender: tVoice(`genders.${parsed.gender}`),
        })
      : null;
  };

  return (
    <>
      <div className="mt-8 space-y-4">
        <div className="max-w-practice space-y-2">
          <label htmlFor={`${ids}-search`} className="block font-medium">
            {t("searchLabel")}
          </label>
          <input
            id={`${ids}-search`}
            type="search"
            value={filter.query}
            onChange={(event) =>
              setFilter({ ...filter, query: event.target.value })
            }
            placeholder={t("searchPlaceholder")}
            className="block w-full rounded-base border border-line bg-surface px-4 py-3 focus-visible:border-accent"
          />
        </div>
        <div
          role="group"
          aria-labelledby={`${ids}-language`}
          className="flex flex-wrap items-center gap-2"
        >
          <span
            id={`${ids}-language`}
            className="mr-2 text-metadata tracking-widest text-ink-muted uppercase"
          >
            {t("languageLabel")}
          </span>
          {LANGUAGES.map((language) => (
            <FilterChip
              key={language}
              on={filter.languages.includes(language)}
              onToggle={() =>
                setFilter({
                  ...filter,
                  languages: toggle(filter.languages, language, LANGUAGES),
                })
              }
            >
              {t("option", {
                label: t(`languages.${language}`),
                count: count((p) => p.sourceLanguage, language),
              })}
            </FilterChip>
          ))}
        </div>
        <div
          role="group"
          aria-labelledby={`${ids}-length`}
          className="flex flex-wrap items-center gap-2"
        >
          <span
            id={`${ids}-length`}
            className="mr-2 text-metadata tracking-widest text-ink-muted uppercase"
          >
            {t("lengthLabel")}
          </span>
          {SENTENCE_BUCKETS.map(({ id }) => (
            <FilterChip
              key={id}
              on={filter.lengths.includes(id)}
              onToggle={() =>
                setFilter({
                  ...filter,
                  lengths: toggle<SentenceBucketId>(
                    filter.lengths,
                    id,
                    SENTENCE_BUCKETS.map((b) => b.id),
                  ),
                })
              }
            >
              {t("option", {
                label: t(`lengths.${id}`),
                count: count((p) => sentenceBucket(p.sentenceCount), id),
              })}
            </FilterChip>
          ))}
          {filtering && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilter(NO_FILTER)}
            >
              {t("clear")}
            </Button>
          )}
        </div>
      </div>
      <p aria-live="polite" className="mt-3 text-supporting text-ink-muted">
        {filtering && t("results", { count: shown.length })}
      </p>

      {shown.length === 0 ? (
        <div className="mt-8 space-y-4">
          <p className="text-ink-muted">{t("empty")}</p>
          <Button variant="secondary" onClick={() => setFilter(NO_FILTER)}>
            {t("clearAll")}
          </Button>
        </div>
      ) : (
        <ul className="mt-8 grid gap-6 split:grid-cols-2">
          {shown.map((practice) => {
            const voice = voiceName(practice.voice);
            return (
              <li key={practice.id}>
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
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

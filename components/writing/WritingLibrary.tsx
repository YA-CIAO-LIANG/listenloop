"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { Button } from "../Button";
import { CardLink } from "../CardLink";
import { FilterChip } from "../FilterChip";
import { Tag } from "../Tag";
import { toggled } from "../useLibraryFilter";
import Link from "next/link";
import {
  EXAM_TRACKS,
  EXAM_TRACK_IDS,
  inWritingTrack,
  type ExamTrackId,
} from "@/lib/exam-tracks";
import {
  filterPrompts,
  hasWritingFilter,
  parseWritingFilter,
  WRITING_FILTER_KEY,
  WRITING_MINUTES,
  writingFilterQuery,
  type WritingFilter,
} from "@/lib/writing/library";
import {
  WRITING_GROUPS,
  WRITING_LEVELS,
  type WritingPrompt,
} from "@/lib/writing/types";
import { useAllWritingProgress } from "./WritingProvider";

export type LibraryPrompt = Pick<
  WritingPrompt,
  "id" | "type" | "level" | "title" | "subtitle" | "words" | "minutes"
>;

function readSaved(): string | null {
  try {
    return localStorage.getItem(WRITING_FILTER_KEY);
  } catch {
    return null;
  }
}

// The saved default, read like an external store (server: none).
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const changed = () => listeners.forEach((listener) => listener());

/**
 * The writing prompts (D187): every filter's buttons shown at once, like
 * ListenLoop's library (D104): kinds, levels, and "minutes I have today";
 * the filter lives in the URL; "Save as my default" applies it whenever
 * the library opens without one.
 */
export function WritingLibrary({ prompts }: { prompts: LibraryPrompt[] }) {
  const t = useTranslations("writing");
  const tAll = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filter = parseWritingFilter(params);
  const progress = useAllWritingProgress();
  const saved = useSyncExternalStore(subscribe, readSaved, () => null);
  const applied = useRef(false);

  // The latest filter, so quick taps build on each other before the
  // URL catches up.
  const latest = useRef(filter);
  const query = writingFilterQuery(filter);
  useEffect(() => {
    latest.current = parseWritingFilter(new URLSearchParams(query));
  }, [query]);

  const setFilter = useCallback(
    (next: WritingFilter) => {
      latest.current = next;
      const query = writingFilterQuery(next);
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [router, pathname],
  );

  // The saved default, once, when the URL has no filter.
  useEffect(() => {
    const value = readSaved();
    if (applied.current) return;
    applied.current = true;
    if (value && !params.toString()) {
      router.replace(`${pathname}?${value}`, { scroll: false });
    }
  }, [params, pathname, router]);

  const save = () => {
    const value = writingFilterQuery(filter);
    try {
      if (value) localStorage.setItem(WRITING_FILTER_KEY, value);
      else localStorage.removeItem(WRITING_FILTER_KEY);
    } catch {
      // Not remembered in this browser.
    }
    changed();
  };

  const shown = filterPrompts(prompts, filter);
  const current = writingFilterQuery(filter);
  const statusOf = (id: string) => progress?.find((p) => p.promptId === id);

  return (
    <section aria-labelledby="writing-library" className="flex flex-col gap-6">
      <h2 id="writing-library" className="font-display text-h2">
        {t("library.heading")}
      </h2>
      <div className="flex flex-col gap-4">
        {/* "Exam English" first (D215): only exams with prompts. */}
        <ChipRow label={t("library.exams")}>
          {EXAM_TRACKS.filter((track) =>
            prompts.some((p) => inWritingTrack(p, track)),
          ).map((track) => (
            <FilterChip
              key={track.id}
              on={filter.exams.includes(track.id)}
              onToggle={() =>
                setFilter({
                  ...latest.current,
                  exams: toggled(
                    latest.current.exams,
                    track.id as ExamTrackId,
                    EXAM_TRACK_IDS,
                  ),
                })
              }
            >
              {tAll(`examTracks.${track.id}`)}
            </FilterChip>
          ))}
          <Link
            href="/exams"
            className="tap self-center text-supporting text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
          >
            {t("library.examGuides")}
          </Link>
        </ChipRow>
        <ChipRow label={t("library.minutes")}>
          {WRITING_MINUTES.map((minutes) => (
            <FilterChip
              key={minutes}
              on={filter.minutes === minutes}
              onToggle={() =>
                setFilter({
                  ...latest.current,
                  minutes: latest.current.minutes === minutes ? null : minutes,
                })
              }
            >
              {t("library.minutesOption", { minutes })}
            </FilterChip>
          ))}
        </ChipRow>
        <ChipRow label={t("library.group")}>
          {WRITING_GROUPS.map((group) => (
            <FilterChip
              key={group}
              on={filter.groups.includes(group)}
              onToggle={() =>
                setFilter({
                  ...latest.current,
                  groups: toggled(latest.current.groups, group, WRITING_GROUPS),
                })
              }
            >
              {t(`groups.${group}`)}
            </FilterChip>
          ))}
        </ChipRow>
        <ChipRow label={t("library.level")}>
          {WRITING_LEVELS.map((level) => (
            <FilterChip
              key={level}
              on={filter.levels.includes(level)}
              onToggle={() =>
                setFilter({
                  ...latest.current,
                  levels: toggled(latest.current.levels, level, WRITING_LEVELS),
                })
              }
            >
              {t(`levels.${level}`)}
            </FilterChip>
          ))}
        </ChipRow>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="secondary"
            onClick={save}
            disabled={(saved ?? "") === current}
          >
            {current ? t("library.saveDefault") : t("library.clearDefault")}
          </Button>
          {hasWritingFilter(filter) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setFilter({ exams: [], groups: [], levels: [], minutes: null })
              }
            >
              {t("library.reset")}
            </Button>
          )}
          <p className="text-supporting text-ink-muted" aria-live="polite">
            {t("library.count", { count: shown.length })}
            {saved !== null &&
              saved === current &&
              ` · ${t("library.isDefault")}`}
          </p>
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="text-ink-muted">{t("library.empty")}</p>
      ) : (
        <ul className="grid gap-4 split:grid-cols-2">
          {shown.map((prompt) => {
            const mine = statusOf(prompt.id);
            return (
              <li key={prompt.id}>
                <CardLink href={`/writing/${prompt.id}`} className="h-full">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-2">
                      <Tag>{t(`types.${prompt.type}`)}</Tag>
                      <Tag>{t(`levels.${prompt.level}`)}</Tag>
                      {mine && (
                        <Tag tone="accent">
                          {mine.status === "passed"
                            ? t("status.passed")
                            : t("status.inProgress")}
                        </Tag>
                      )}
                    </div>
                    <h3 className="font-display text-h3">
                      <span lang="en">{prompt.title.en}</span>
                      {locale !== "en" && (
                        <span className="block text-body text-ink-muted">
                          {prompt.title.zh}
                        </span>
                      )}
                    </h3>
                    <p className="text-supporting text-ink-muted">
                      {prompt.subtitle}
                    </p>
                    <p className="text-supporting text-ink-muted tabular-nums">
                      {t("library.words", prompt.words)} ·{" "}
                      {t("library.time", { minutes: prompt.minutes })}
                    </p>
                  </div>
                </CardLink>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ChipRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      <p className="text-supporting text-ink-muted" aria-hidden="true">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

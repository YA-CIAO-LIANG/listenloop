"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useState, type ReactNode } from "react";
import { searchOfficialLibrary } from "@/app/library-actions";
import {
  activeFilterCount,
  filterLibrary,
  NO_LIBRARY_FILTER,
  presentValues,
  type LibraryFilter,
  type LibraryItem,
} from "@/lib/library";
import {
  LIBRARY_LENGTHS,
  LIBRARY_MINUTES,
  LIBRARY_SORTS,
  MAIN_CATEGORY_COUNT,
  MAX_CATEGORIES,
  SEARCH_DEBOUNCE_MS,
  type LibrarySort,
} from "@/lib/library-config";
import { Button } from "./Button";
import { FilterChip } from "./FilterChip";
import { MaterialCard } from "./MaterialCard";
import { toggled, useLibraryFilter } from "./useLibraryFilter";
import { dailyMinutes } from "@/lib/library-time";
import type { CategoryId } from "@/lib/categories";
import {
  EXAM_TRACKS,
  inListeningTrack,
  type ExamTrackId,
} from "@/lib/exam-tracks";
import Link from "next/link";
import { LibraryDefaultControls, useLibraryDefault } from "./LibraryDefault";

type ViewProps = {
  items: readonly LibraryItem[];
  filter: LibraryFilter;
  onChange: (next: LibraryFilter) => void;
};

const groupLabel = "text-metadata tracking-widest text-ink-muted uppercase";

/** One row of filter chips with a label, as a named group. */
function FilterGroup({
  label,
  note,
  children,
}: {
  label: string;
  /** Beside the label, e.g. "3 of 5 chosen"; read out when it changes. */
  note?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="space-y-2">
      <p className="flex flex-wrap items-baseline justify-between gap-2">
        <span id={id} className={groupLabel}>
          {label}
        </span>
        <span aria-live="polite" className="text-metadata text-ink-muted">
          {note}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** Single-choice chips: one value or none ("any"). */
function SingleChoice<T extends string | number>({
  label,
  anyLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  anyLabel: string;
  value: T | null;
  options: readonly { value: T; label: string }[];
  onChange: (next: T | null) => void;
}) {
  return (
    <FilterGroup label={label}>
      <FilterChip on={value === null} onToggle={() => onChange(null)}>
        {anyLabel}
      </FilterChip>
      {options.map((option) => (
        <FilterChip
          key={option.value}
          on={value === option.value}
          onToggle={() =>
            onChange(value === option.value ? null : option.value)
          }
        >
          {option.label}
        </FilterChip>
      ))}
    </FilterGroup>
  );
}

/**
 * Every filter (D70, D127), most used first: the minutes I have today,
 * level, category (the most common ones, the rest behind "More
 * categories"), then type, audio length, and accent. All chips, applied
 * at once. A group shows only when the library has more than one value
 * for it (or one is chosen); each chip counts the materials with that
 * value.
 */
export function LibraryFilters({ items, filter, onChange }: ViewProps) {
  const t = useTranslations("library.filters");
  const tAll = useTranslations();
  const [moreCategories, setMoreCategories] = useState(false);
  const present = presentValues(items);
  const count = (match: (item: LibraryItem) => boolean) =>
    items.filter(match).length;
  const shows = (values: readonly unknown[], chosen: readonly unknown[]) =>
    values.length > 1 || chosen.length > 0;
  const tCategories = useTranslations("categories");
  // Scenarios show once a category is chosen: those it really has (D79).
  const scenarios = present.scenarios.filter((scenario) =>
    items.some(
      (i) =>
        i.scenario === scenario &&
        i.category !== null &&
        filter.categories.includes(i.category),
    ),
  );
  // The most common categories first (D127); chosen ones always show.
  const byCount = [...present.categories].sort(
    (a, b) => count((i) => i.category === b) - count((i) => i.category === a),
  );
  const main = new Set(byCount.slice(0, MAIN_CATEGORY_COUNT));
  const shownCategories = present.categories.filter(
    (category) =>
      moreCategories ||
      main.has(category) ||
      filter.categories.includes(category),
  );
  const hiddenCategories = present.categories.length - shownCategories.length;

  const categoryChip = (category: CategoryId) => {
    const on = filter.categories.includes(category);
    return (
      <FilterChip
        key={category}
        on={on}
        // Up to MAX_CATEGORIES; the rest wait until one is off.
        disabled={!on && filter.categories.length >= MAX_CATEGORIES}
        onToggle={() =>
          onChange({
            ...filter,
            categories: toggled(
              filter.categories,
              category,
              present.categories,
            ),
            // A category turned off takes its scenarios with it.
            scenarios: on
              ? filter.scenarios.filter((sc) =>
                  items.some(
                    (i) =>
                      i.scenario === sc &&
                      i.category !== category &&
                      i.category !== null &&
                      filter.categories.includes(i.category),
                  ),
                )
              : filter.scenarios,
          })
        }
      >
        {t("option", {
          label: tAll(`categories.names.${category}`),
          count: count((i) => i.category === category),
        })}
      </FilterChip>
    );
  };

  // "Exam English" first (D215): only exams the library has.
  const exams = EXAM_TRACKS.filter((track) =>
    items.some((item) => inListeningTrack(item, track)),
  );

  return (
    <div className="space-y-6">
      {exams.length > 0 && (
        <div className="space-y-2">
          <FilterGroup label={t("exams")}>
            {exams.map((track) => {
              const on = filter.exams.includes(track.id);
              return (
                <FilterChip
                  key={track.id}
                  on={on}
                  onToggle={() =>
                    onChange({
                      ...filter,
                      exams: toggled(
                        filter.exams,
                        track.id as ExamTrackId,
                        EXAM_TRACKS.map((x) => x.id),
                      ),
                    })
                  }
                >
                  {t("option", {
                    label: tAll(`examTracks.${track.id}`),
                    count: count((i) => inListeningTrack(i, track)),
                  })}
                </FilterChip>
              );
            })}
          </FilterGroup>
          <Link
            href="/exams"
            className="tap inline-block text-supporting text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
          >
            {t("examGuides")}
          </Link>
        </div>
      )}
      {/* "How many minutes do I have today" comes next (D127). */}
      <SingleChoice
        label={t("minutes")}
        anyLabel={t("anyMinutes")}
        value={filter.minutes}
        options={LIBRARY_MINUTES.map((minutes) => ({
          value: minutes,
          label: t("option", {
            label: t("minutesOption", { minutes }),
            count: count((i) => dailyMinutes(i) <= minutes),
          }),
        }))}
        onChange={(minutes) => onChange({ ...filter, minutes })}
      />
      {shows(present.levels, filter.levels) && (
        <FilterGroup label={t("level")}>
          {present.levels.map((level) => (
            <FilterChip
              key={level}
              on={filter.levels.includes(level)}
              onToggle={() =>
                onChange({
                  ...filter,
                  levels: toggled(filter.levels, level, present.levels),
                })
              }
            >
              {t("option", {
                label: tAll(`video.levels.${level}`),
                count: count((i) => i.level === level),
              })}
            </FilterChip>
          ))}
        </FilterGroup>
      )}
      {shows(present.categories, filter.categories) && (
        <FilterGroup
          label={t("category")}
          note={
            filter.categories.length > 0
              ? t("categoriesChosen", {
                  count: filter.categories.length,
                  max: MAX_CATEGORIES,
                })
              : undefined
          }
        >
          {/* "All" clears every category (D104). */}
          <FilterChip
            on={filter.categories.length === 0}
            onToggle={() =>
              onChange({ ...filter, categories: [], scenarios: [] })
            }
          >
            {t("allCategories")}
          </FilterChip>
          {shownCategories.map(categoryChip)}
          {(hiddenCategories > 0 || moreCategories) &&
            present.categories.length > MAIN_CATEGORY_COUNT && (
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={moreCategories}
                onClick={() => setMoreCategories(!moreCategories)}
              >
                {moreCategories
                  ? t("fewerCategories")
                  : t("moreCategories", { count: hiddenCategories })}
              </Button>
            )}
        </FilterGroup>
      )}
      {scenarios.length > 0 && (
        <FilterGroup label={t("scenario")}>
          {scenarios.map((scenario) => (
            <FilterChip
              key={scenario}
              on={filter.scenarios.includes(scenario)}
              onToggle={() =>
                onChange({
                  ...filter,
                  scenarios: toggled(filter.scenarios, scenario, scenarios),
                })
              }
            >
              {t("option", {
                label: tCategories(
                  `scenarios.${scenario}` as "scenarios.restaurant",
                ),
                count: count((i) => i.scenario === scenario),
              })}
            </FilterChip>
          ))}
        </FilterGroup>
      )}
      {shows(present.kinds, filter.kinds) && (
        <FilterGroup label={t("kind")}>
          {present.kinds.map((kind) => (
            <FilterChip
              key={kind}
              on={filter.kinds.includes(kind)}
              onToggle={() =>
                onChange({
                  ...filter,
                  kinds: toggled(filter.kinds, kind, present.kinds),
                })
              }
            >
              {t("option", {
                label: tAll(`library.kinds.${kind}`),
                count: count((i) => i.kind === kind),
              })}
            </FilterChip>
          ))}
        </FilterGroup>
      )}
      {/* Audio length, one range (D104), as chips like the rest (D127). */}
      <SingleChoice
        label={t("length")}
        anyLabel={t("lengths.all")}
        value={filter.length === "all" ? null : filter.length}
        options={LIBRARY_LENGTHS.filter((length) => length.id !== "all").map(
          (length) => ({ value: length.id, label: t(`lengths.${length.id}`) }),
        )}
        onChange={(length) => onChange({ ...filter, length: length ?? "all" })}
      />
      {shows(present.accents, filter.accents) && (
        <FilterGroup label={t("accent")}>
          {present.accents.map((accent) => (
            <FilterChip
              key={accent}
              on={filter.accents.includes(accent)}
              onToggle={() =>
                onChange({
                  ...filter,
                  accents: toggled(filter.accents, accent, present.accents),
                })
              }
            >
              {t("option", {
                label: tAll(`voicePicker.accents.${accent}`),
                count: count((i) => i.accent === accent),
              })}
            </FilterChip>
          ))}
        </FilterGroup>
      )}
    </div>
  );
}

/**
 * The library (D70, D127): search and sort above the cards; the filters
 * in a sidebar on wide screens, and open in the page below the search on
 * narrower ones (foldable). The match count is announced as it changes.
 */
export function MaterialLibraryView({
  items,
  filter,
  onChange,
  found = null,
  searching = false,
  defaults,
}: ViewProps & {
  /** The ids the official search found (D104); null until it answers. */
  found?: ReadonlySet<string> | null;
  /** The search is waiting or running. */
  searching?: boolean;
  /** "Save as my default filter" (D98), under the filters. */
  defaults?: ReactNode;
}) {
  const t = useTranslations("library.filters");
  const ids = useId();
  // Phones show the filters open too (D127), and can fold them away.
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState(filter.query);
  const shown = filterLibrary(items, filter, found);
  const active = activeFilterCount(filter);
  const filtering = active > 0 || filter.query.trim() !== "";
  const clear = () => {
    setQuery("");
    onChange({ ...NO_LIBRARY_FILTER, sort: filter.sort });
  };

  return (
    <div className="mt-8 wide:grid wide:grid-cols-[15rem_1fr] wide:gap-12">
      <aside aria-label={t("title")} className="hidden wide:block">
        <LibraryFilters items={items} filter={filter} onChange={onChange} />
        {defaults && <div className="mt-6">{defaults}</div>}
      </aside>

      <div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 basis-48 space-y-2">
            <label htmlFor={`${ids}-search`} className={`block ${groupLabel}`}>
              {t("search")}
            </label>
            <input
              id={`${ids}-search`}
              type="search"
              value={query}
              placeholder={t("searchPlaceholder")}
              onChange={(event) => {
                setQuery(event.target.value);
                onChange({ ...filter, query: event.target.value });
              }}
              className="h-10 w-full rounded-base border border-line bg-surface px-3 text-body placeholder:text-ink-muted pointer-coarse:min-h-11"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor={`${ids}-sort`} className={`block ${groupLabel}`}>
              {t("sort")}
            </label>
            <select
              id={`${ids}-sort`}
              value={filter.sort}
              onChange={(event) =>
                onChange({ ...filter, sort: event.target.value as LibrarySort })
              }
              className="h-10 rounded-base border border-line bg-surface px-3 text-body pointer-coarse:min-h-11"
            >
              {LIBRARY_SORTS.map((sort) => (
                <option key={sort} value={sort}>
                  {t(`sorts.${sort}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Below wide: the filters in the page, open by default (D127). */}
        <section
          aria-labelledby={`${ids}-filters`}
          className="mt-6 rounded-base border border-line p-4 wide:hidden"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 id={`${ids}-filters`} className={groupLabel}>
              {active > 0 ? t("openCount", { count: active }) : t("title")}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={open}
              aria-controls={`${ids}-panel`}
              onClick={() => setOpen(!open)}
            >
              {open ? t("collapse") : t("expand")}
            </Button>
          </div>
          <div id={`${ids}-panel`} hidden={!open} className="mt-4 space-y-6">
            <LibraryFilters items={items} filter={filter} onChange={onChange} />
            {defaults}
          </div>
        </section>

        <p
          aria-live="polite"
          className="mt-4 flex flex-wrap items-center gap-x-3 text-supporting text-ink-muted"
        >
          <span>
            {searching ? t("searching") : t("results", { count: shown.length })}
          </span>
          {filtering && shown.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clear}>
              {t("clear")}
            </Button>
          )}
        </p>

        {shown.length === 0 ? (
          <div className="mt-6 space-y-4">
            <p className="text-ink-muted">{t("empty")}</p>
            <Button variant="secondary" onClick={clear}>
              {t("clearAll")}
            </Button>
          </div>
        ) : (
          <ul className="mt-6 grid gap-6 split:grid-cols-2">
            {shown.map((item) => (
              <li key={item.id}>
                <MaterialCard item={item} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * The library with its filter in the URL. Render inside <Suspense>. The
 * learner's default filter (D98) applies when the page opens without one:
 * from their account when signed in (`savedDefault`, null if none), else
 * from this browser (`savedDefault` undefined).
 */
export function MaterialLibrary({
  items,
  savedDefault,
}: {
  items: readonly LibraryItem[];
  savedDefault?: string | null;
}) {
  const [filter, setFilter] = useLibraryFilter();
  const defaults = useLibraryDefault(savedDefault, setFilter);
  const { found, searching } = useOfficialSearch(filter);
  return (
    <MaterialLibraryView
      items={items}
      filter={filter}
      onChange={setFilter}
      found={found}
      searching={searching}
      defaults={<LibraryDefaultControls filter={filter} {...defaults} />}
    />
  );
}

/** The library with no filter: the <Suspense> fallback (server render). */
export function UnfilteredMaterialLibrary({
  items,
}: {
  items: readonly LibraryItem[];
}) {
  return (
    <MaterialLibraryView
      items={items}
      filter={NO_LIBRARY_FILTER}
      onChange={() => {}}
    />
  );
}

/**
 * Searches the official library on the server by category (overlaps) and
 * audio length (gte / lte) as they change, SEARCH_DEBOUNCE_MS after the
 * last tap (D104). With neither set, nothing is asked: every item counts.
 * If the search fails, the same rules apply on this page instead.
 */
function useOfficialSearch(filter: LibraryFilter): {
  found: ReadonlySet<string> | null;
  searching: boolean;
} {
  const categories = filter.categories.join(",");
  const { length } = filter;
  const idle = categories === "" && length === "all";
  const [result, setResult] = useState<{
    key: string;
    ids: ReadonlySet<string> | null;
  } | null>(null);
  const key = `${categories}|${length}`;

  useEffect(() => {
    if (idle) return;
    let current = true;
    const timer = setTimeout(async () => {
      const answer = await searchOfficialLibrary({
        categories: categories.split(","),
        length,
      }).catch(() => null);
      if (!current) return;
      setResult({ key, ids: answer?.ok ? new Set(answer.ids) : null });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [idle, categories, length, key]);

  if (idle) return { found: null, searching: false };
  if (result?.key !== key) return { found: null, searching: true };
  return { found: result.ids, searching: false };
}

"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";
import { LENGTH_BUCKETS, lengthBucket } from "@/lib/excerpt-length";
import {
  activeFilterCount,
  estimateMinutes,
  filterLibrary,
  NO_LIBRARY_FILTER,
  presentValues,
  type LibraryFilter,
  type LibraryItem,
} from "@/lib/library";
import {
  LIBRARY_SORTS,
  TIME_BUDGETS,
  type LibrarySort,
} from "@/lib/library-config";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { FilterChip } from "./FilterChip";
import { MaterialCard } from "./MaterialCard";
import { toggled, useLibraryFilter } from "./useLibraryFilter";

type ViewProps = {
  items: readonly LibraryItem[];
  filter: LibraryFilter;
  onChange: (next: LibraryFilter) => void;
};

const groupLabel = "text-metadata tracking-widest text-ink-muted uppercase";

/** One row of filter chips with a label, as a named group. */
function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="space-y-2">
      <p id={id} className={groupLabel}>
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/**
 * Every filter (D70): type, category, level, length, accent, and the time
 * a day takes. A group shows only when the library has more than one
 * value for it (or one is chosen); each chip counts the materials with
 * that value.
 */
export function LibraryFilters({ items, filter, onChange }: ViewProps) {
  const t = useTranslations("library.filters");
  const tAll = useTranslations();
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

  return (
    <div className="space-y-6">
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
      {shows(present.categories, filter.categories) && (
        <FilterGroup label={t("category")}>
          {present.categories.map((category) => (
            <FilterChip
              key={category}
              on={filter.categories.includes(category)}
              onToggle={() =>
                onChange({
                  ...filter,
                  categories: toggled(
                    filter.categories,
                    category,
                    present.categories,
                  ),
                  // A category turned off takes its scenarios with it.
                  scenarios: filter.categories.includes(category)
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
          ))}
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
      {shows(present.lengths, filter.lengths) && (
        <FilterGroup label={t("length")}>
          {present.lengths.map((length) => (
            <FilterChip
              key={length}
              on={filter.lengths.includes(length)}
              onToggle={() =>
                onChange({
                  ...filter,
                  lengths: toggled(
                    filter.lengths,
                    length,
                    LENGTH_BUCKETS.map((b) => b.id),
                  ),
                })
              }
            >
              {t("option", {
                label: tAll(`library.length.buckets.${length}`),
                count: count((i) => lengthBucket(i.seconds) === length),
              })}
            </FilterChip>
          ))}
        </FilterGroup>
      )}
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
 * The library (D70): search and sort above the cards; the filters in a
 * sidebar on wide screens, and in a bottom drawer behind "篩選（N）" on
 * phones. The match count is announced as it changes.
 */
export function MaterialLibraryView({ items, filter, onChange }: ViewProps) {
  const t = useTranslations("library.filters");
  const ids = useId();
  const [drawer, setDrawer] = useState(false);
  const [query, setQuery] = useState(filter.query);
  const shown = filterLibrary(items, filter);
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
      </aside>

      <div>
        <TimeBudget items={items} filter={filter} onChange={onChange} />
        <div className="mt-6 flex flex-wrap items-end gap-3">
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
          <Button
            variant="secondary"
            className="wide:hidden"
            aria-haspopup="dialog"
            onClick={() => setDrawer(true)}
          >
            {active > 0 ? t("openCount", { count: active }) : t("open")}
          </Button>
        </div>

        <p
          aria-live="polite"
          className="mt-4 flex flex-wrap items-center gap-x-3 text-supporting text-ink-muted"
        >
          <span>{t("results", { count: shown.length })}</span>
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

      {drawer && (
        <Dialog
          title={t("title")}
          variant="sheet"
          onClose={() => setDrawer(false)}
        >
          <LibraryFilters items={items} filter={filter} onChange={onChange} />
          <div className="flex flex-wrap gap-3 border-t border-line pt-4">
            <Button variant="primary" onClick={() => setDrawer(false)}>
              {t("show", { count: shown.length })}
            </Button>
            {active > 0 && (
              <Button variant="secondary" onClick={clear}>
                {t("clearAll")}
              </Button>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}

/** The library with its filter in the URL. Render inside <Suspense>. */
export function MaterialLibrary({ items }: { items: readonly LibraryItem[] }) {
  const [filter, setFilter] = useLibraryFilter();
  return (
    <MaterialLibraryView items={items} filter={filter} onChange={setFilter} />
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
 * "我今天有幾分鐘？" (D70, D79): above the library for everyone, one tap
 * keeps what a day's practice fits in; tapping it again shows all.
 */
function TimeBudget({ items, filter, onChange }: ViewProps) {
  const t = useTranslations("library.time");
  const id = useId();
  return (
    <div className="space-y-2">
      <p id={id} className="font-medium">
        {t("title")}
      </p>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2">
        {TIME_BUDGETS.map((minutes) => (
          <FilterChip
            key={minutes}
            on={filter.minutes === minutes}
            onToggle={() =>
              onChange({
                ...filter,
                minutes: filter.minutes === minutes ? null : minutes,
              })
            }
          >
            {t("option", {
              minutes,
              count: items.filter((i) => estimateMinutes(i.seconds) <= minutes)
                .length,
            })}
          </FilterChip>
        ))}
      </div>
    </div>
  );
}

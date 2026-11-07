import { VOICE_ACCENTS, type VoiceAccent } from "@/lib/ai/types";
import {
  CATEGORY_IDS,
  LEVELS,
  type CategoryId,
  type Level,
} from "@/lib/categories";
import {
  LENGTH_BUCKETS,
  lengthBucket,
  type LengthBucketId,
} from "./excerpt-length";
import {
  LIBRARY_SORTS,
  PRACTICE_TIME_FACTOR,
  TIME_BUDGETS,
  type LibrarySort,
  type TimeBudget,
} from "./library-config";
import { parseVoiceId } from "@/lib/ai/types";
import { isCategoryId, isLevel } from "@/lib/categories";
import type { PublicPracticeSummary } from "@/lib/custom-practice/explore";
import { excerptSeconds } from "./excerpt-length";
import type { Video, VideoCategory } from "./videos";

/**
 * The library (D70): built-in videos and official audio practices as one
 * list of materials, with the filters, search, and sort orders the home
 * page offers. Everything here is pure; the server builds the items and
 * the browser filters them (the list is small).
 */

export const MATERIAL_KINDS = ["video", "audio"] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];

export type LibraryItem = {
  /** Video id, or "p-<uuid>" for a practice: the id in /videos/<id>. */
  id: string;
  kind: MaterialKind;
  title: string;
  /** One sentence on what it's about (D71); null until written. */
  subtitle: string | null;
  category: CategoryId | null;
  exam: string | null;
  /** Exam target id, e.g. "toeic-750". */
  examTarget: string | null;
  level: Level | null;
  /** How long the material runs. */
  seconds: number;
  accent: VoiceAccent | null;
  sentenceCount: number;
  /** ISO time; built-in videos use the date they were added. */
  createdAt: string;
  /** The admins' order for official practices; null for the rest. */
  sortOrder: number | null;
  /** How many people have practiced it. */
  learners: number;
};

/** Built-in videos' own categories in the library's (D70). */
export const VIDEO_CATEGORY_IN_LIBRARY: Readonly<
  Record<VideoCategory, CategoryId>
> = {
  daily: "daily-life",
  campus: "campus",
  business: "business",
  interview: "talks-stories",
  story: "talks-stories",
};

/** A day's practice in minutes, rounded up (at least 1). */
export function estimateMinutes(seconds: number): number {
  return Math.max(1, Math.ceil((seconds * PRACTICE_TIME_FACTOR) / 60));
}

export type LibraryFilter = {
  query: string;
  kinds: readonly MaterialKind[];
  categories: readonly CategoryId[];
  levels: readonly Level[];
  lengths: readonly LengthBucketId[];
  accents: readonly VoiceAccent[];
  /** "How many minutes do I have today?"; null: any. */
  minutes: TimeBudget | null;
  sort: LibrarySort;
};

export const NO_LIBRARY_FILTER: LibraryFilter = {
  query: "",
  kinds: [],
  categories: [],
  levels: [],
  lengths: [],
  accents: [],
  minutes: null,
  sort: LIBRARY_SORTS[0],
};

/** URL parameter names, short since they're shared in links. */
export const LIBRARY_PARAMS = {
  query: "q",
  kinds: "type",
  categories: "cat",
  levels: "level",
  lengths: "length",
  accents: "accent",
  minutes: "min",
  sort: "sort",
} as const;

/** The known values from a comma list, in `known`'s order, each once. */
function pick<T extends string>(
  known: readonly T[],
  value: string | null,
): T[] {
  if (!value) return [];
  const wanted = new Set(value.split(","));
  return known.filter((id) => wanted.has(id));
}

/** The filter in the URL; unknown values are dropped. */
export function parseLibraryParams(params: {
  get(name: string): string | null;
}): LibraryFilter {
  const minutes = Number(params.get(LIBRARY_PARAMS.minutes));
  const sort = params.get(LIBRARY_PARAMS.sort);
  return {
    query: (params.get(LIBRARY_PARAMS.query) ?? "").slice(0, 100),
    kinds: pick(MATERIAL_KINDS, params.get(LIBRARY_PARAMS.kinds)),
    categories: pick(CATEGORY_IDS, params.get(LIBRARY_PARAMS.categories)),
    levels: pick(LEVELS, params.get(LIBRARY_PARAMS.levels)),
    lengths: pick(
      LENGTH_BUCKETS.map((b) => b.id),
      params.get(LIBRARY_PARAMS.lengths),
    ),
    accents: pick(VOICE_ACCENTS, params.get(LIBRARY_PARAMS.accents)),
    minutes: (TIME_BUDGETS as readonly number[]).includes(minutes)
      ? (minutes as TimeBudget)
      : null,
    sort: (LIBRARY_SORTS as readonly (string | null)[]).includes(sort)
      ? (sort as LibrarySort)
      : LIBRARY_SORTS[0],
  };
}

/**
 * `filter` written into `params` (other parameters kept); empty parts
 * and the default sort are left out, so a plain library has a plain URL.
 */
export function writeLibraryParams(
  params: URLSearchParams,
  filter: LibraryFilter,
): URLSearchParams {
  const next = new URLSearchParams(params);
  const set = (name: string, value: string) =>
    value ? next.set(name, value) : next.delete(name);
  set(LIBRARY_PARAMS.query, filter.query.trim());
  set(LIBRARY_PARAMS.kinds, filter.kinds.join(","));
  set(LIBRARY_PARAMS.categories, filter.categories.join(","));
  set(LIBRARY_PARAMS.levels, filter.levels.join(","));
  set(LIBRARY_PARAMS.lengths, filter.lengths.join(","));
  set(LIBRARY_PARAMS.accents, filter.accents.join(","));
  set(LIBRARY_PARAMS.minutes, filter.minutes ? String(filter.minutes) : "");
  set(LIBRARY_PARAMS.sort, filter.sort === LIBRARY_SORTS[0] ? "" : filter.sort);
  return next;
}

/** How many filters are on (the sort and search aside), for "篩選（3）". */
export function activeFilterCount(filter: LibraryFilter): number {
  return (
    filter.kinds.length +
    filter.categories.length +
    filter.levels.length +
    filter.lengths.length +
    filter.accents.length +
    (filter.minutes ? 1 : 0)
  );
}

/** Lowercased, full-width letters folded, runs of spaces as one. */
const normalize = (text: string) =>
  text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

/** Whether one item passes every filter (sort aside). */
export function matchesLibraryFilter(
  item: LibraryItem,
  filter: LibraryFilter,
): boolean {
  const words = normalize(filter.query).split(" ").filter(Boolean);
  const text = normalize(`${item.title} ${item.subtitle ?? ""}`);
  if (!words.every((word) => text.includes(word))) return false;
  const within = <T>(chosen: readonly T[], value: T | null) =>
    chosen.length === 0 || (value !== null && chosen.includes(value));
  return (
    within(filter.kinds, item.kind) &&
    within(filter.categories, item.category) &&
    within(filter.levels, item.level) &&
    within(filter.lengths, lengthBucket(item.seconds)) &&
    within(filter.accents, item.accent) &&
    (filter.minutes === null || estimateMinutes(item.seconds) <= filter.minutes)
  );
}

const LEVEL_RANK: Record<Level, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

/**
 * The library's default order: official practices in the admins' order,
 * then the rest from the easiest level, the shortest first.
 */
function recommended(a: LibraryItem, b: LibraryItem): number {
  const order = (item: LibraryItem) => item.sortOrder ?? Infinity;
  if (order(a) !== order(b)) return order(a) - order(b);
  const rank = (item: LibraryItem) =>
    item.level ? LEVEL_RANK[item.level] : LEVEL_RANK.intermediate;
  return rank(a) - rank(b) || a.seconds - b.seconds;
}

const COMPARE: Record<LibrarySort, (a: LibraryItem, b: LibraryItem) => number> =
  {
    recommended,
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    shortest: (a, b) => a.seconds - b.seconds,
    popular: (a, b) => b.learners - a.learners,
  };

/** The matching items, sorted; ties keep the recommended order. */
export function filterLibrary(
  items: readonly LibraryItem[],
  filter: LibraryFilter,
): LibraryItem[] {
  return items
    .filter((item) => matchesLibraryFilter(item, filter))
    .sort((a, b) => COMPARE[filter.sort](a, b) || recommended(a, b));
}

/** Which values of a filter appear at all, so empty choices can hide. */
export function presentValues(items: readonly LibraryItem[]) {
  const has = <T>(values: readonly T[], of: (item: LibraryItem) => T | null) =>
    values.filter((value) => items.some((item) => of(item) === value));
  return {
    kinds: has(MATERIAL_KINDS, (item) => item.kind),
    categories: has(CATEGORY_IDS, (item) => item.category),
    levels: has(LEVELS, (item) => item.level),
    lengths: has(
      LENGTH_BUCKETS.map((b) => b.id),
      (item) => lengthBucket(item.seconds),
    ),
    accents: has(VOICE_ACCENTS, (item) => item.accent),
  };
}

/** Built-in videos have no creation time; they sort as added on this day. */
const BUILT_IN_ADDED = "2026-10-24T00:00:00Z";

export function videoLibraryItem(video: Video, learners = 0): LibraryItem {
  return {
    id: video.id,
    kind: "video",
    title: video.title,
    subtitle: video.subtitle ?? null,
    category: VIDEO_CATEGORY_IN_LIBRARY[video.category],
    exam: null,
    examTarget: null,
    level: video.level,
    seconds: excerptSeconds(video.sentences),
    accent: video.accent ?? null,
    sentenceCount: video.sentences.length,
    createdAt: BUILT_IN_ADDED,
    sortOrder: null,
    learners,
  };
}

/**
 * A practice as a library item. `seconds` is its audio's length; when
 * that's unknown, about 130 words a minute (D36) from the sentence count
 * at 12 words a sentence.
 */
export function practiceLibraryItem(
  practice: PublicPracticeSummary,
  { seconds, learners = 0 }: { seconds?: number; learners?: number } = {},
): LibraryItem {
  return {
    id: practice.id,
    kind: "audio",
    title: practice.title,
    subtitle: practice.subtitle,
    category: isCategoryId(practice.category) ? practice.category : null,
    exam: practice.exam,
    examTarget: practice.examTarget,
    level: isLevel(practice.level) ? practice.level : null,
    seconds: Math.round(seconds ?? (practice.sentenceCount * 12 * 60) / 130),
    accent: practice.voice
      ? (parseVoiceId(practice.voice)?.accent ?? null)
      : null,
    sentenceCount: practice.sentenceCount,
    createdAt: practice.createdAt,
    sortOrder: practice.sortOrder,
    learners,
  };
}

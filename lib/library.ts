import {
  EXAM_TRACK_IDS,
  findExamTrack,
  inListeningTrack,
  type ExamTrackId,
} from "./exam-tracks";
import { WORDS_PER_MINUTE } from "@/lib/custom-practice/generation";
import { VOICE_ACCENTS, type VoiceAccent } from "@/lib/ai/types";
import {
  allScenarioIds,
  CATEGORY_IDS,
  LEVELS,
  type CategoryId,
  type Level,
} from "@/lib/categories";
import {
  isLibraryLengthId,
  isLibraryMinutes,
  LIBRARY_LENGTHS,
  LIBRARY_SORTS,
  MAX_CATEGORIES,
  type LibraryLengthId,
  type LibraryMinutes,
  type LibrarySort,
} from "./library-config";
import { dailyMinutes } from "./library-time";
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
  /** English title (D83). */
  title: string;
  /** Chinese title, shown under the English one; null until there is one. */
  titleZh: string | null;
  /** One sentence on what it's about (D71); null until written. */
  subtitle: string | null;
  category: CategoryId | null;
  /** Scenario id within the category (lib/categories.ts), or null. */
  scenario: string | null;
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

/** Every scenario id, in display order (exam parts last). */
const SCENARIO_IDS: readonly string[] = allScenarioIds();

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

export type LibraryFilter = {
  query: string;
  /** "Exam English" (D215): exams (GEPT by level), any of them. */
  exams: readonly ExamTrackId[];
  kinds: readonly MaterialKind[];
  categories: readonly CategoryId[];
  /** Scenarios within the chosen categories (D79). */
  scenarios: readonly string[];
  levels: readonly Level[];
  /** Audio length (D104): one range, "all" by default. */
  length: LibraryLengthId;
  accents: readonly VoiceAccent[];
  /** Minutes a practice day may take (D127); null: any. */
  minutes: LibraryMinutes | null;
  sort: LibrarySort;
};

export const NO_LIBRARY_FILTER: LibraryFilter = {
  query: "",
  exams: [],
  kinds: [],
  categories: [],
  scenarios: [],
  levels: [],
  length: "all",
  accents: [],
  minutes: null,
  sort: LIBRARY_SORTS[0],
};

/** URL parameter names, short since they're shared in links. */
export const LIBRARY_PARAMS = {
  query: "q",
  exams: "exam",
  kinds: "type",
  categories: "cat",
  scenarios: "sc",
  levels: "level",
  length: "len",
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
  const sort = params.get(LIBRARY_PARAMS.sort);
  const length = params.get(LIBRARY_PARAMS.length);
  return {
    query: (params.get(LIBRARY_PARAMS.query) ?? "").slice(0, 100),
    exams: pick(EXAM_TRACK_IDS, params.get(LIBRARY_PARAMS.exams)),
    kinds: pick(MATERIAL_KINDS, params.get(LIBRARY_PARAMS.kinds)),
    // At most MAX_CATEGORIES (D104).
    categories: pick(CATEGORY_IDS, params.get(LIBRARY_PARAMS.categories)).slice(
      0,
      MAX_CATEGORIES,
    ),
    scenarios: pick(SCENARIO_IDS, params.get(LIBRARY_PARAMS.scenarios)),
    levels: pick(LEVELS, params.get(LIBRARY_PARAMS.levels)),
    length: isLibraryLengthId(length) ? length : "all",
    accents: pick(VOICE_ACCENTS, params.get(LIBRARY_PARAMS.accents)),
    minutes: (() => {
      const minutes = Number(params.get(LIBRARY_PARAMS.minutes));
      return isLibraryMinutes(minutes) ? minutes : null;
    })(),
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
  set(LIBRARY_PARAMS.exams, filter.exams.join(","));
  set(LIBRARY_PARAMS.kinds, filter.kinds.join(","));
  set(LIBRARY_PARAMS.categories, filter.categories.join(","));
  set(LIBRARY_PARAMS.scenarios, filter.scenarios.join(","));
  set(LIBRARY_PARAMS.levels, filter.levels.join(","));
  set(LIBRARY_PARAMS.length, filter.length === "all" ? "" : filter.length);
  set(LIBRARY_PARAMS.accents, filter.accents.join(","));
  set(
    LIBRARY_PARAMS.minutes,
    filter.minutes === null ? "" : String(filter.minutes),
  );
  set(LIBRARY_PARAMS.sort, filter.sort === LIBRARY_SORTS[0] ? "" : filter.sort);
  return next;
}

/** How many filters in the panel are on, for "篩選（3）". */
export function activeFilterCount(filter: LibraryFilter): number {
  return (
    filter.exams.length +
    filter.kinds.length +
    filter.categories.length +
    filter.scenarios.length +
    filter.levels.length +
    (filter.length === "all" ? 0 : 1) +
    filter.accents.length +
    (filter.minutes === null ? 0 : 1)
  );
}

/** Lowercased, full-width letters folded, runs of spaces as one. */
const normalize = (text: string) =>
  text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

/** Whether `seconds` is inside a length choice (D104), ends included. */
export function inLength(seconds: number, length: LibraryLengthId): boolean {
  const range = LIBRARY_LENGTHS.find((l) => l.id === length)!;
  // Whole seconds, like duration_sec, so no length falls between ranges.
  const whole = Math.round(seconds);
  return (
    (range.min === null || whole >= range.min) &&
    (range.max === null || whole <= range.max)
  );
}

/** Whether a material is in any of the categories (none chosen: all). */
export function inCategories(
  category: CategoryId | null,
  categories: readonly CategoryId[],
): boolean {
  return (
    categories.length === 0 ||
    (category !== null && categories.includes(category))
  );
}

/** Whether one item passes every filter (sort aside). */
export function matchesLibraryFilter(
  item: LibraryItem,
  filter: LibraryFilter,
): boolean {
  const words = normalize(filter.query).split(" ").filter(Boolean);
  // Both titles and the subtitle (D83).
  const text = normalize(
    `${item.title} ${item.titleZh ?? ""} ${item.subtitle ?? ""}`,
  );
  if (!words.every((word) => text.includes(word))) return false;
  const within = <T>(chosen: readonly T[], value: T | null) =>
    chosen.length === 0 || (value !== null && chosen.includes(value));
  return (
    (filter.exams.length === 0 ||
      filter.exams.some((id) => inListeningTrack(item, findExamTrack(id)!))) &&
    within(filter.kinds, item.kind) &&
    inCategories(item.category, filter.categories) &&
    within(filter.scenarios, item.scenario) &&
    within(filter.levels, item.level) &&
    inLength(item.seconds, filter.length) &&
    within(filter.accents, item.accent) &&
    (filter.minutes === null || dailyMinutes(item) <= filter.minutes)
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
  /**
   * The ids the server's search found for the categories and length
   * (D104); null until it answers (the same test runs here meanwhile).
   */
  found: ReadonlySet<string> | null = null,
): LibraryItem[] {
  return items
    .filter(
      (item) =>
        matchesLibraryFilter(item, filter) &&
        (found === null || found.has(item.id)),
    )
    .sort((a, b) => COMPARE[filter.sort](a, b) || recommended(a, b));
}

/** Which values of a filter appear at all, so empty choices can hide. */
export function presentValues(items: readonly LibraryItem[]) {
  const has = <T>(values: readonly T[], of: (item: LibraryItem) => T | null) =>
    values.filter((value) => items.some((item) => of(item) === value));
  return {
    kinds: has(MATERIAL_KINDS, (item) => item.kind),
    categories: has(CATEGORY_IDS, (item) => item.category),
    scenarios: has(SCENARIO_IDS, (item) => item.scenario),
    levels: has(LEVELS, (item) => item.level),
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
    titleZh: video.titleZh ?? null,
    subtitle: video.subtitle ?? null,
    category: VIDEO_CATEGORY_IN_LIBRARY[video.category],
    scenario: null,
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
 * that's unknown, WORDS_PER_MINUTE (D36, D142) from the sentence count
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
    titleZh: practice.titleZh,
    subtitle: practice.subtitle,
    category: isCategoryId(practice.category) ? practice.category : null,
    scenario: practice.scenario,
    exam: practice.exam,
    examTarget: practice.examTarget,
    level: isLevel(practice.level) ? practice.level : null,
    seconds: Math.round(
      seconds ?? (practice.sentenceCount * 12 * 60) / WORDS_PER_MINUTE,
    ),
    accent: practice.voice
      ? (parseVoiceId(practice.voice)?.accent ?? null)
      : null,
    sentenceCount: practice.sentenceCount,
    createdAt: practice.createdAt,
    sortOrder: practice.sortOrder,
    learners,
  };
}

/** Whether the URL sets any part of the library's filter (D98). */
export function hasLibraryParams(params: {
  has(name: string): boolean;
}): boolean {
  return Object.values(LIBRARY_PARAMS).some((name) => params.has(name));
}

/**
 * A saved default filter (D98), stored as the URL query it would make;
 * unknown values are dropped as in a URL. Null when there's none.
 */
export function parseSavedFilter(value: unknown): LibraryFilter | null {
  if (typeof value !== "string" || value.length > 2000) return null;
  const params = new URLSearchParams(value);
  return hasLibraryParams(params) ? parseLibraryParams(params) : null;
}

/** The filter as the string a default is saved as. */
export function savedFilterString(filter: LibraryFilter): string {
  return writeLibraryParams(new URLSearchParams(), filter).toString();
}

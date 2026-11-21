import {
  WRITING_GROUPS,
  WRITING_LEVELS,
  WRITING_TYPE_CONFIG,
  type WritingGroup,
  type WritingLevel,
  type WritingPrompt,
} from "./types";

/**
 * The writing library's filter (D187), like ListenLoop's (D70, D104,
 * D127): kept in the URL, tag buttons that are all visible, "how many
 * minutes do I have today", and a default that can be saved.
 */
export type WritingFilter = {
  groups: WritingGroup[];
  levels: WritingLevel[];
  /** Only prompts whose suggested time fits; null: any. */
  minutes: number | null;
};

export const WRITING_MINUTES = [10, 15, 20, 30, 40] as const;
export const NO_WRITING_FILTER: WritingFilter = {
  groups: [],
  levels: [],
  minutes: null,
};
/** This browser's saved default filter (the URL query it stands for). */
export const WRITING_FILTER_KEY = "ll-writing-filter:v1";

const pick = <T extends string>(raw: string | null, allowed: readonly T[]) =>
  (raw ?? "")
    .split(",")
    .filter((v): v is T => (allowed as readonly string[]).includes(v))
    .filter((v, i, all) => all.indexOf(v) === i);

export function parseWritingFilter(params: URLSearchParams): WritingFilter {
  const minutes = Number(params.get("m"));
  return {
    groups: pick(params.get("g"), WRITING_GROUPS),
    levels: pick(params.get("l"), WRITING_LEVELS),
    minutes: (WRITING_MINUTES as readonly number[]).includes(minutes)
      ? minutes
      : null,
  };
}

export function writingFilterQuery(filter: WritingFilter): string {
  const params = new URLSearchParams();
  if (filter.groups.length) params.set("g", filter.groups.join(","));
  if (filter.levels.length) params.set("l", filter.levels.join(","));
  if (filter.minutes !== null) params.set("m", String(filter.minutes));
  return params.toString();
}

export const hasWritingFilter = (filter: WritingFilter) =>
  filter.groups.length > 0 ||
  filter.levels.length > 0 ||
  filter.minutes !== null;

/** The prompts that match, in the library's order. */
export function filterPrompts<
  P extends Pick<WritingPrompt, "type" | "level" | "minutes">,
>(prompts: readonly P[], filter: WritingFilter): P[] {
  return prompts.filter(
    (p) =>
      (!filter.groups.length ||
        filter.groups.includes(WRITING_TYPE_CONFIG[p.type].group)) &&
      (!filter.levels.length || filter.levels.includes(p.level)) &&
      (filter.minutes === null || p.minutes <= filter.minutes),
  );
}

import {
  MAX_REWRITE_VERSIONS,
  type EssayRewrite,
  type RewriteVersion,
} from "./types";

/**
 * Day 1's rewrite versions as the learner works with them (D218): kept
 * with Day 1, a version added each time one is asked for, and the one
 * chosen for Days 2–6. Rewrites of an earlier essay (Day 1 written
 * again) start over.
 */
export function addVersion(
  rewrite: EssayRewrite | undefined,
  essay: string,
  version: RewriteVersion,
): EssayRewrite {
  const versions = rewrite?.essay === essay ? rewrite.versions : [];
  return {
    essay,
    versions: [...versions, version].slice(-MAX_REWRITE_VERSIONS),
    ...(rewrite?.essay === essay && rewrite.chosen
      ? { chosen: rewrite.chosen }
      : {}),
  };
}

export const chooseVersion = (
  rewrite: EssayRewrite | undefined,
  id: string,
): EssayRewrite | undefined =>
  rewrite && rewrite.versions.some((v) => v.id === id)
    ? { ...rewrite, chosen: id }
    : rewrite;

/** The version to show: the one asked for, else the chosen, else the latest. */
export function shownVersion(
  rewrite: EssayRewrite | undefined,
  id: string | null,
): RewriteVersion | undefined {
  if (!rewrite) return undefined;
  return (
    rewrite.versions.find((v) => v.id === id) ??
    rewrite.versions.find((v) => v.id === rewrite.chosen) ??
    rewrite.versions.at(-1)
  );
}

/** How many more versions this essay may have. */
export const versionsLeft = (rewrite: EssayRewrite | undefined) =>
  Math.max(0, MAX_REWRITE_VERSIONS - (rewrite?.versions.length ?? 0));

/** The version chosen for Days 2–6, when it's of this essay. */
export function chosenVersion(
  day1: { essay: string; rewrite?: EssayRewrite } | undefined,
): RewriteVersion | undefined {
  const rewrite = day1?.rewrite;
  if (!rewrite || rewrite.essay !== day1?.essay || !rewrite.chosen) {
    return undefined;
  }
  return rewrite.versions.find((v) => v.id === rewrite.chosen);
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/** A stored rewrite, or undefined when it isn't recognizably ours. */
export function parseRewrite(value: unknown): EssayRewrite | undefined {
  if (!isObject(value) || typeof value.essay !== "string") return undefined;
  const versions = (Array.isArray(value.versions) ? value.versions : [])
    .filter(
      (v): v is RewriteVersion =>
        isObject(v) &&
        typeof v.id === "string" &&
        Array.isArray(v.sentences) &&
        v.sentences.every(
          (s: unknown) =>
            isObject(s) &&
            typeof s.revised === "string" &&
            typeof s.original === "string",
        ),
    )
    .slice(-MAX_REWRITE_VERSIONS);
  return {
    essay: value.essay,
    versions,
    ...(typeof value.chosen === "string" &&
    versions.some((v) => v.id === value.chosen)
      ? { chosen: value.chosen }
      : {}),
  };
}

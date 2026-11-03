/**
 * Checks for organizing created practices (roadmap d5): collection names
 * and public/private. Input comes from Server Actions, so it's `unknown`.
 */
export const VISIBILITIES = ["private", "public"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const COLLECTION_TITLE_MAX = 100;

export function isVisibility(value: unknown): value is Visibility {
  return (VISIBILITIES as readonly unknown[]).includes(value);
}

/** The tidied name, or null if it's empty or longer than `max`. */
export function cleanName(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/\s+/g, " ").trim();
  return name && [...name].length <= max ? name : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** Notebooks (D25); the database checks the same limits. */
export const NOTEBOOK_LIMITS = {
  title: 100,
  text: 1000,
  note: 2000,
} as const;

/** The tidied note: may be empty, keeps line breaks; null if too long. */
export function cleanNote(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return null;
  const note = value.replace(/[ \t]+/g, " ").trim();
  return [...note].length <= max ? note : null;
}

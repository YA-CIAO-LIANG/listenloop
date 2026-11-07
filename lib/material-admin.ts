/**
 * Managing materials on the admin dashboard (D58): an official practice
 * is a draft (private, waiting) or published (public, in the library).
 * The library's order is sort_order, renumbered 1, 2, 3… on each move.
 */
export const OFFICIAL_STATES = ["none", "draft", "published"] as const;
export type OfficialState = (typeof OFFICIAL_STATES)[number];

export const isOfficialState = (value: unknown): value is OfficialState =>
  (OFFICIAL_STATES as readonly unknown[]).includes(value);

export function officialState(row: {
  official: boolean;
  published: boolean;
}): OfficialState {
  return !row.official ? "none" : row.published ? "published" : "draft";
}

/** The columns an official state sets (an official draft is private). */
export function officialColumns(
  state: OfficialState,
):
  | { official: false; published: true }
  | { official: true; published: false; visibility: "private" }
  | { official: true; published: true; visibility: "public" } {
  switch (state) {
    case "none":
      return { official: false, published: true };
    case "draft":
      return { official: true, published: false, visibility: "private" };
    case "published":
      return { official: true, published: true, visibility: "public" };
  }
}

/**
 * The library order after moving `id` one place up (-1) or down (1):
 * the ids in their new order. Unknown ids or moves past an end change
 * nothing.
 */
export function moveInOrder(
  ids: readonly string[],
  id: string,
  by: -1 | 1,
): string[] {
  const from = ids.indexOf(id);
  const to = from + by;
  if (from === -1 || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** Statuses the material list can be filtered by. */
export const MATERIAL_FILTERS = [
  "all",
  "draft",
  "published",
  "public",
] as const;
export type MaterialFilter = (typeof MATERIAL_FILTERS)[number];

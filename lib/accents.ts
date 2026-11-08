/**
 * Accent colors (D93): the site's highlight color, which practice score
 * unlocks. The colors themselves are in app/globals.css (`data-accent`),
 * tuned for contrast in light and dark mode; this is the list, the order,
 * and what each one takes. Orange is the default and always open.
 */
export const ACCENTS = [
  { id: "orange", unlockAt: 0 },
  { id: "teal", unlockAt: 100 },
  { id: "blue", unlockAt: 250 },
  { id: "violet", unlockAt: 500 },
  { id: "rose", unlockAt: 800 },
  { id: "green", unlockAt: 1200 },
  { id: "gold", unlockAt: 1600 },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];

export const DEFAULT_ACCENT: AccentId = "orange";

/**
 * "Unlock forever" for one color (a fake door, D93): the price shown;
 * pressing it records the interest, nothing is charged.
 */
export const ACCENT_UNLOCK_PRICE = { amount: 30, currency: "TWD" } as const;

/** Where this browser remembers the chosen color. */
export const ACCENT_STORAGE_KEY = "ll-accent";

export const isAccentId = (value: unknown): value is AccentId =>
  ACCENTS.some((accent) => accent.id === value);

export function isUnlocked(id: AccentId, score: number): boolean {
  const accent = ACCENTS.find((a) => a.id === id);
  return accent !== undefined && score >= accent.unlockAt;
}

/** The next color to unlock and the points still needed, if any. */
export function nextUnlock(
  score: number,
): { id: AccentId; needed: number } | null {
  const next = ACCENTS.find((accent) => accent.unlockAt > score);
  return next ? { id: next.id, needed: next.unlockAt - score } : null;
}

/** The `data-accent` value for <html>; the default needs none. */
export function accentAttribute(id: AccentId): AccentId | null {
  return id === DEFAULT_ACCENT ? null : id;
}

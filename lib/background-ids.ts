/**
 * The background themes' ids (D121), apart from their drawings
 * (lib/backgrounds.ts), so the theme script in every page's <head> stays
 * small. tests/backgrounds.test.ts checks the two lists match.
 */
export const BACKGROUND_IDS = [
  "default",
  "pure",
  "warm-gray",
  "paper",
  "notebook",
  "kraft",
  "forest",
  "ocean",
  "mountain",
  "sunset",
  "cafe",
  "city",
  "rain",
  "washi",
  "retro",
  "nordic",
  "stars",
  "pastel",
  "high-contrast",
] as const;

export type BackgroundId = (typeof BACKGROUND_IDS)[number];

export const DEFAULT_BACKGROUND: BackgroundId = "default";

/** Where this browser remembers the chosen background. */
export const BACKGROUND_STORAGE_KEY = "ll-background";

export const isBackgroundId = (value: unknown): value is BackgroundId =>
  (BACKGROUND_IDS as readonly unknown[]).includes(value);

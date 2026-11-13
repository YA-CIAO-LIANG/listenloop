/**
 * Themes (D121, refined in D166). A theme is a complete look, in a light
 * and a dark version: the page's ground and its texture, the card style
 * (solid, paper, or frosted glass) with its surface, lines, and shadow,
 * the text colors, and an accent color that goes with all of it. Drawn
 * with CSS gradients and tiny inline SVGs (no image files, nothing
 * copyrighted). Some are free, some open with practice score (like
 * accent colors, D93), and the animated ones have an "unlock forever"
 * fake door.
 *
 * Everything about a theme is here; app/backgrounds.css is written from
 * it (`npm run backgrounds:css`, checked by tests/backgrounds.test.ts),
 * and tests/theme-contrast.test.ts works out every text and button
 * color's contrast on every color a theme can show (lib/theme-contrast.ts).
 * Components keep using the design tokens (`--ll-ground`, `--ll-surface`,
 * `--ll-ink`, …); a theme only changes their values.
 */

import { DEFAULT_BACKGROUND, type BackgroundId } from "./background-ids.ts";

export {
  BACKGROUND_STORAGE_KEY,
  DEFAULT_BACKGROUND,
  isBackgroundId,
  type BackgroundId,
} from "./background-ids.ts";

export type Hex = `#${string}`;

/** A pattern's single color and how strongly it's drawn at most. */
export type Ink = { color: Hex; alpha: number };

export type Pattern =
  | { kind: "none" }
  /** Ruled or grid lines, `size` px apart. */
  | { kind: "lines"; ink: Ink; size: number; grid: boolean }
  /** Round dots on a grid. */
  | { kind: "dots"; ink: Ink; size: number; radius: number }
  /** Fine paper grain (SVG fractal noise). */
  | { kind: "grain"; ink: Ink }
  /** Soft color blobs across the page. */
  | { kind: "blobs"; inks: Ink[] }
  /** A vertical gradient over the whole page; each stop is a ground. */
  | { kind: "gradient"; stops: Hex[] }
  /** A drawing: `svg` is the tile's markup for a color and an opacity. */
  | {
      kind: "svg";
      ink: Ink;
      tile: { width: number; height: number };
      svg: (color: string, alpha: number) => string;
      /** A silhouette along the bottom of the screen, not a tile. */
      bottom?: boolean;
    };

/** How cards (the `surface-card` utility) look in a theme. */
export const CARD_STYLES = ["solid", "paper", "glass"] as const;
export type CardStyle = (typeof CARD_STYLES)[number];

/** One color scheme of a theme: every color token it sets. */
export type BackgroundMode = {
  ground: Hex;
  /** Cards, inputs, menus (opaque; glass cards let some ground through). */
  surface: Hex;
  /** Alternate section background. */
  band: Hex;
  line: Hex;
  ink: Hex;
  inkMuted: Hex;
  /** Lines, fills, focus ring (≥ 3:1); `accentInk` is its text color. */
  accent: Hex;
  accentInk: Hex;
  pattern: Pattern;
  /** A soft glow from the top of the page, under the pattern. */
  wash?: Ink;
};

export const BACKGROUND_GROUPS = [
  "minimal",
  "paper",
  "nature",
  "city",
  "culture",
  "other",
] as const;
export type BackgroundGroup = (typeof BACKGROUND_GROUPS)[number];

export type Unlock =
  | { kind: "free" }
  | { kind: "score"; at: number }
  /** A fake door (D121): the price shows; nothing is sold yet. */
  | { kind: "paid" };

export type Motion = "twinkle" | "rain";

export type Background = {
  id: BackgroundId;
  group: BackgroundGroup;
  unlock: Unlock;
  card: CardStyle;
  /** Animated (still under prefers-reduced-motion). */
  motion?: Motion;
  light: BackgroundMode;
  dark: BackgroundMode;
};

/** Shown first in the picker (D166); the rest are grouped by style. */
export const RECOMMENDED_BACKGROUNDS: readonly BackgroundId[] = [
  "default",
  "paper",
  "warm-gray",
  "ocean",
  "forest",
  "pastel",
];

/** "Unlock forever" for an animated background: the price shown. */
export const BACKGROUND_UNLOCK_PRICE = { amount: 60, currency: "TWD" } as const;

/** How much of a glass card's surface covers the ground behind it. */
export const GLASS_ALPHA = { light: 0.78, dark: 0.74 } as const;

/** A paper card's grain at its strongest (over the surface). */
export const PAPER_GRAIN = {
  light: { color: "#5a4a30", alpha: 0.05 },
  dark: { color: "#f5ead2", alpha: 0.035 },
} as const satisfies Record<"light" | "dark", Ink>;

const ink = (color: Hex, alpha: number): Ink => ({ color, alpha });

const tree = (c: string, a: number) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><g fill='${c}' fill-opacity='${a}'><path d='M24 84 L36 52 L48 84 Z M28 64 L36 40 L44 64 Z'/><rect x='34.5' y='84' width='3' height='8'/><path d='M80 104 L90 78 L100 104 Z M83 88 L90 68 L97 88 Z'/><rect x='88.5' y='104' width='3' height='6'/></g></svg>`;

const wave = (c: string, a: number) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='48'><path d='M0 24 Q20 14 40 24 T80 24 T120 24 T160 24' fill='none' stroke='${c}' stroke-opacity='${a}' stroke-width='1.25'/></svg>`;

const ridge = (c: string, a: number) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='240' viewBox='0 0 1200 240' preserveAspectRatio='none'><path d='M0 240 L0 150 L140 70 L260 140 L380 40 L520 150 L640 90 L780 160 L900 60 L1040 140 L1200 80 L1200 240 Z' fill='${c}' fill-opacity='${a}'/><path d='M0 240 L0 190 L180 130 L320 190 L470 120 L620 200 L760 140 L920 200 L1080 130 L1200 180 L1200 240 Z' fill='${c}' fill-opacity='${a}'/></svg>`;

const skyline = (c: string, a: number) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='200' viewBox='0 0 1200 200' preserveAspectRatio='none'><path d='M0 200 V120 H60 V80 H110 V130 H160 V60 H220 V110 H260 V40 H320 V120 H370 V90 H430 V140 H480 V70 H540 V100 H600 V30 H650 V120 H700 V80 H770 V130 H820 V50 H880 V110 H930 V90 H990 V140 H1040 V60 H1100 V120 H1150 V100 H1200 V200 Z' fill='${c}' fill-opacity='${a}'/></svg>`;

const beans = (c: string, a: number) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><g fill='none' stroke='${c}' stroke-opacity='${a}' stroke-width='1.25'><ellipse cx='26' cy='28' rx='8' ry='12' transform='rotate(-30 26 28)'/><path d='M21 20 Q28 28 31 37'/><ellipse cx='72' cy='70' rx='8' ry='12' transform='rotate(25 72 70)'/><path d='M68 61 Q73 70 76 79'/></g></svg>`;

const seigaiha = (c: string, a: number) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='30'><g fill='none' stroke='${c}' stroke-opacity='${a}' stroke-width='1'><circle cx='30' cy='30' r='28'/><circle cx='30' cy='30' r='20'/><circle cx='30' cy='30' r='12'/><circle cx='0' cy='15' r='28'/><circle cx='0' cy='15' r='20'/><circle cx='60' cy='15' r='28'/><circle cx='60' cy='15' r='20'/></g></svg>`;

const nordic = (c: string, a: number) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><g fill='none' stroke='${c}' stroke-opacity='${a}' stroke-width='1.25' stroke-linecap='round'><path d='M20 14 V26 M14 20 H26'/><path d='M52 46 L62 56 M62 46 L52 56'/><path d='M16 62 L23 55 L30 62'/><circle cx='60' cy='20' r='4'/></g></svg>`;

const starfield = (c: string, a: number) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><g fill='${c}' fill-opacity='${a}'><circle cx='20' cy='30' r='1.1'/><circle cx='70' cy='12' r='0.7'/><circle cx='120' cy='60' r='1.3'/><circle cx='190' cy='24' r='0.9'/><circle cx='40' cy='110' r='0.8'/><circle cx='160' cy='120' r='1.1'/><circle cx='95' cy='160' r='0.9'/><circle cx='200' cy='190' r='0.7'/><circle cx='15' cy='190' r='1.2'/><circle cx='130' cy='205' r='0.6'/></g></svg>`;

const streaks = (c: string, a: number) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='90' height='120'><g stroke='${c}' stroke-opacity='${a}' stroke-width='1' stroke-linecap='round'><path d='M10 0 L5 16'/><path d='M50 40 L45 56'/><path d='M80 10 L75 26'/><path d='M30 80 L25 96'/><path d='M70 90 L65 106'/></g></svg>`;

const svgPattern = (
  svg: (c: string, a: number) => string,
  color: Hex,
  alpha: number,
  tile: { width: number; height: number },
  bottom?: boolean,
): Pattern => ({ kind: "svg", ink: ink(color, alpha), tile, svg, bottom });

export const BACKGROUNDS: Background[] = [
  {
    // Must equal the defaults in app/globals.css (checked by the tests).
    id: "default",
    group: "minimal",
    unlock: { kind: "free" },
    card: "solid",
    light: {
      ground: "#fafaf8",
      surface: "#ffffff",
      band: "#f2f1ed",
      line: "#e5e3de",
      ink: "#141414",
      inkMuted: "#5c5c5c",
      accent: "#e8590c",
      accentInk: "#a63d09",
      pattern: { kind: "none" },
    },
    dark: {
      ground: "#121212",
      surface: "#1c1c1c",
      band: "#181818",
      line: "#2e2e2e",
      ink: "#f2f2f0",
      inkMuted: "#a3a3a0",
      accent: "#ff7a33",
      accentInk: "#ff8f52",
      pattern: { kind: "none" },
    },
  },
  {
    id: "pure",
    group: "minimal",
    unlock: { kind: "free" },
    card: "solid",
    light: {
      ground: "#ffffff",
      surface: "#ffffff",
      band: "#f5f5f5",
      line: "#e3e3e3",
      ink: "#0a0a0a",
      inkMuted: "#555555",
      accent: "#e8590c",
      accentInk: "#a63d09",
      pattern: { kind: "none" },
    },
    dark: {
      ground: "#000000",
      surface: "#111111",
      band: "#0a0a0a",
      line: "#2a2a2a",
      ink: "#f5f5f5",
      inkMuted: "#a6a6a6",
      accent: "#ff7a33",
      accentInk: "#ff8f52",
      pattern: { kind: "none" },
    },
  },
  {
    id: "warm-gray",
    group: "minimal",
    unlock: { kind: "free" },
    card: "solid",
    light: {
      ground: "#f3f1ec",
      surface: "#fcfbf8",
      band: "#ebe8e1",
      line: "#e0dcd3",
      ink: "#1c1a17",
      inkMuted: "#5a564e",
      accent: "#c8501f",
      accentInk: "#9a3a14",
      pattern: { kind: "none" },
      wash: ink("#ffffff", 0.5),
    },
    dark: {
      ground: "#1a1917",
      surface: "#23221f",
      band: "#1f1e1b",
      line: "#36342f",
      ink: "#f1efea",
      inkMuted: "#aba69c",
      accent: "#ee8a5a",
      accentInk: "#f3a27a",
      pattern: { kind: "none" },
    },
  },
  {
    id: "paper",
    group: "paper",
    unlock: { kind: "free" },
    card: "paper",
    light: {
      ground: "#f6f0e2",
      surface: "#fdfaf2",
      band: "#efe7d5",
      line: "#e4d9c2",
      ink: "#1f1a12",
      inkMuted: "#5c5242",
      accent: "#b5532a",
      accentInk: "#8a3d1d",
      pattern: { kind: "grain", ink: ink("#7a5c2e", 0.05) },
      wash: ink("#fffaf0", 0.6),
    },
    dark: {
      ground: "#1a1813",
      surface: "#24211a",
      band: "#1f1c16",
      line: "#3a3529",
      ink: "#f2ebdb",
      inkMuted: "#b4aa94",
      accent: "#e39a6b",
      accentInk: "#efb48c",
      pattern: { kind: "grain", ink: ink("#f2e6c8", 0.035) },
    },
  },
  {
    id: "notebook",
    group: "paper",
    unlock: { kind: "score", at: 100 },
    card: "paper",
    light: {
      ground: "#f8fafd",
      surface: "#ffffff",
      band: "#eef2f8",
      line: "#dbe2ee",
      ink: "#141b26",
      inkMuted: "#4f5a6b",
      accent: "#3366c4",
      accentInk: "#24498c",
      pattern: {
        kind: "lines",
        ink: ink("#5b7fb5", 0.1),
        size: 24,
        grid: true,
      },
    },
    dark: {
      ground: "#10141b",
      surface: "#182029",
      band: "#141a22",
      line: "#2b3644",
      ink: "#e8edf5",
      inkMuted: "#9ba8ba",
      accent: "#7aa7f0",
      accentInk: "#9cbdf5",
      pattern: {
        kind: "lines",
        ink: ink("#8fb0e0", 0.06),
        size: 24,
        grid: true,
      },
    },
  },
  {
    id: "kraft",
    group: "paper",
    unlock: { kind: "score", at: 200 },
    card: "paper",
    light: {
      ground: "#f4ecdc",
      surface: "#faf4e7",
      band: "#e8dcc3",
      line: "#dccfb4",
      ink: "#231b10",
      inkMuted: "#594b36",
      accent: "#9c5b17",
      accentInk: "#7a4510",
      pattern: { kind: "grain", ink: ink("#6b4a1f", 0.06) },
      wash: ink("#fbf3e2", 0.5),
    },
    dark: {
      ground: "#1c1610",
      surface: "#272017",
      band: "#221b13",
      line: "#3d3326",
      ink: "#f2e7d3",
      inkMuted: "#b9a98d",
      accent: "#d9a066",
      accentInk: "#e8b986",
      pattern: { kind: "grain", ink: ink("#e8cfa4", 0.035) },
    },
  },
  {
    id: "forest",
    group: "nature",
    unlock: { kind: "score", at: 300 },
    card: "paper",
    light: {
      ground: "#eef4ec",
      surface: "#fbfdfa",
      band: "#e5eee2",
      line: "#d4e0d0",
      ink: "#13201a",
      inkMuted: "#4a5c50",
      accent: "#2f7d4f",
      accentInk: "#1f5c39",
      pattern: svgPattern(tree, "#2f6b3c", 0.05, { width: 120, height: 120 }),
      wash: ink("#fbfff5", 0.6),
    },
    dark: {
      ground: "#0d1510",
      surface: "#16201a",
      band: "#111a14",
      line: "#26352b",
      ink: "#e6f0e8",
      inkMuted: "#9cb3a3",
      accent: "#6cc791",
      accentInk: "#8fd8aa",
      pattern: svgPattern(tree, "#8fd19e", 0.04, { width: 120, height: 120 }),
      wash: ink("#1d3324", 0.5),
    },
  },
  {
    id: "ocean",
    group: "nature",
    unlock: { kind: "score", at: 400 },
    card: "glass",
    light: {
      ground: "#eaf3f8",
      surface: "#ffffff",
      band: "#e0edf4",
      line: "#cfe0ea",
      ink: "#0f1d26",
      inkMuted: "#475b69",
      accent: "#1f6f9f",
      accentInk: "#175679",
      pattern: svgPattern(wave, "#2a6f97", 0.08, { width: 160, height: 48 }),
      wash: ink("#ffffff", 0.7),
    },
    dark: {
      ground: "#0a131a",
      surface: "#13202a",
      band: "#0e1921",
      line: "#233544",
      ink: "#e4eff6",
      inkMuted: "#97adbd",
      accent: "#5fb4e0",
      accentInk: "#86c8ea",
      pattern: svgPattern(wave, "#7ec3e6", 0.06, { width: 160, height: 48 }),
      wash: ink("#14354a", 0.6),
    },
  },
  {
    id: "mountain",
    group: "nature",
    unlock: { kind: "score", at: 1100 },
    card: "solid",
    light: {
      ground: "#f1f3f6",
      surface: "#ffffff",
      band: "#e8ecf1",
      line: "#d9dfe7",
      ink: "#151a22",
      inkMuted: "#515b6b",
      accent: "#4a63a8",
      accentInk: "#374c86",
      pattern: svgPattern(
        ridge,
        "#4a5d78",
        0.06,
        { width: 1200, height: 240 },
        true,
      ),
      wash: ink("#ffffff", 0.6),
    },
    dark: {
      ground: "#0e1117",
      surface: "#171b23",
      band: "#12161d",
      line: "#2a303b",
      ink: "#e8ebf0",
      inkMuted: "#a0a8b6",
      accent: "#8ea4e0",
      accentInk: "#a9bbea",
      pattern: svgPattern(
        ridge,
        "#9fb3d1",
        0.045,
        { width: 1200, height: 240 },
        true,
      ),
    },
  },
  {
    id: "sunset",
    group: "nature",
    unlock: { kind: "score", at: 1400 },
    card: "glass",
    light: {
      ground: "#fdf1e7",
      surface: "#fffaf6",
      band: "#f9e8dc",
      line: "#efdcd2",
      ink: "#23161a",
      inkMuted: "#634f57",
      accent: "#c94f37",
      accentInk: "#933422",
      pattern: {
        kind: "gradient",
        stops: ["#fdf1e7", "#fbe9ec", "#f1ecf8"],
      },
    },
    dark: {
      ground: "#1a1018",
      surface: "#24171f",
      band: "#1e131b",
      line: "#3b2832",
      ink: "#f6e9ec",
      inkMuted: "#bfa5ad",
      accent: "#f08a6c",
      accentInk: "#f6a58c",
      pattern: {
        kind: "gradient",
        stops: ["#1c1220", "#1d1014", "#120f1c"],
      },
    },
  },
  {
    id: "cafe",
    group: "city",
    unlock: { kind: "paid" },
    card: "paper",
    light: {
      ground: "#f4ece2",
      surface: "#fcf8f3",
      band: "#ede3d6",
      line: "#e1d4c3",
      ink: "#20160f",
      inkMuted: "#5c4d40",
      accent: "#8b5a3c",
      accentInk: "#6e4329",
      pattern: svgPattern(beans, "#6f4e37", 0.07, { width: 96, height: 96 }),
    },
    dark: {
      ground: "#16110d",
      surface: "#211a14",
      band: "#1b1510",
      line: "#382c22",
      ink: "#f2e8de",
      inkMuted: "#b8a796",
      accent: "#d39b72",
      accentInk: "#e2b38f",
      pattern: svgPattern(beans, "#d9a77c", 0.05, { width: 96, height: 96 }),
      wash: ink("#3a2414", 0.45),
    },
  },
  {
    id: "city",
    group: "city",
    unlock: { kind: "paid" },
    card: "glass",
    light: {
      ground: "#eef1f5",
      surface: "#ffffff",
      band: "#e5e9ef",
      line: "#d6dce5",
      ink: "#121722",
      inkMuted: "#4f596a",
      accent: "#3d5bd1",
      accentInk: "#2f48b0",
      pattern: svgPattern(
        skyline,
        "#3d4a63",
        0.07,
        { width: 1200, height: 200 },
        true,
      ),
      wash: ink("#ffffff", 0.6),
    },
    dark: {
      ground: "#0b0e15",
      surface: "#141925",
      band: "#10141d",
      line: "#252c3b",
      ink: "#e7eaf2",
      inkMuted: "#9ea6b8",
      accent: "#7c95f0",
      accentInk: "#a0b2f5",
      pattern: svgPattern(
        skyline,
        "#8aa0c8",
        0.055,
        { width: 1200, height: 200 },
        true,
      ),
      wash: ink("#1b2442", 0.6),
    },
  },
  {
    id: "rain",
    group: "city",
    unlock: { kind: "paid" },
    motion: "rain",
    card: "glass",
    light: {
      ground: "#edf0f3",
      surface: "#ffffff",
      band: "#e4e8ec",
      line: "#d3dae1",
      ink: "#131a21",
      inkMuted: "#4d5966",
      accent: "#3f6f8f",
      accentInk: "#2f5670",
      pattern: svgPattern(streaks, "#4f6b85", 0.07, { width: 90, height: 120 }),
    },
    dark: {
      ground: "#0c1016",
      surface: "#151b23",
      band: "#10151c",
      line: "#26303b",
      ink: "#e5ebf1",
      inkMuted: "#9caab8",
      accent: "#78aed0",
      accentInk: "#9bc3dd",
      pattern: svgPattern(streaks, "#9db7d1", 0.07, { width: 90, height: 120 }),
    },
  },
  {
    id: "washi",
    group: "culture",
    unlock: { kind: "score", at: 500 },
    card: "paper",
    light: {
      ground: "#f5f1e8",
      surface: "#fcfaf5",
      band: "#ede8dc",
      line: "#e0d9c9",
      ink: "#1a1d26",
      inkMuted: "#525764",
      accent: "#2f5490",
      accentInk: "#233f6b",
      pattern: svgPattern(seigaiha, "#2b4a7a", 0.06, { width: 60, height: 30 }),
    },
    dark: {
      ground: "#0e1220",
      surface: "#171c2c",
      band: "#121726",
      line: "#2a3045",
      ink: "#e9ecf4",
      inkMuted: "#a2a9bf",
      accent: "#8ba8e0",
      accentInk: "#a9bfe8",
      pattern: svgPattern(seigaiha, "#9fb6e0", 0.045, {
        width: 60,
        height: 30,
      }),
    },
  },
  {
    id: "retro",
    group: "culture",
    unlock: { kind: "score", at: 900 },
    card: "solid",
    light: {
      ground: "#f6efe0",
      surface: "#fffaf0",
      band: "#efe5d0",
      line: "#e3d5b8",
      ink: "#22190c",
      inkMuted: "#5c4f38",
      accent: "#b5651d",
      accentInk: "#8a4b12",
      pattern: {
        kind: "dots",
        ink: ink("#c08a1e", 0.12),
        size: 24,
        radius: 2.5,
      },
    },
    dark: {
      ground: "#19150f",
      surface: "#241e15",
      band: "#1e1912",
      line: "#3b3223",
      ink: "#f3e9d6",
      inkMuted: "#bbab8c",
      accent: "#e0a95a",
      accentInk: "#ebbe7d",
      pattern: {
        kind: "dots",
        ink: ink("#e0b45a", 0.06),
        size: 24,
        radius: 2.5,
      },
    },
  },
  {
    id: "nordic",
    group: "culture",
    unlock: { kind: "score", at: 700 },
    card: "solid",
    light: {
      ground: "#f2f5f4",
      surface: "#ffffff",
      band: "#e9eeec",
      line: "#d7e0dd",
      ink: "#14201f",
      inkMuted: "#4c5c5a",
      accent: "#2f7270",
      accentInk: "#225755",
      pattern: svgPattern(nordic, "#3e6b6a", 0.07, { width: 80, height: 80 }),
    },
    dark: {
      ground: "#101615",
      surface: "#182120",
      band: "#131a19",
      line: "#283533",
      ink: "#e5efed",
      inkMuted: "#9db2af",
      accent: "#6cc1bc",
      accentInk: "#8fd2ce",
      pattern: svgPattern(nordic, "#9cc8c6", 0.05, { width: 80, height: 80 }),
    },
  },
  {
    id: "stars",
    group: "other",
    unlock: { kind: "paid" },
    motion: "twinkle",
    card: "glass",
    light: {
      ground: "#f4f4fa",
      surface: "#ffffff",
      band: "#ebebf5",
      line: "#dcdcea",
      ink: "#16162a",
      inkMuted: "#52536b",
      accent: "#5b4fc4",
      accentInk: "#4a3fa6",
      pattern: svgPattern(starfield, "#3d3f7a", 0.06, {
        width: 220,
        height: 220,
      }),
    },
    dark: {
      ground: "#080914",
      surface: "#12142a",
      band: "#0c0e1e",
      line: "#262946",
      ink: "#eceefe",
      inkMuted: "#a5a8c8",
      accent: "#a99cf5",
      accentInk: "#c0b6f8",
      pattern: svgPattern(starfield, "#ffffff", 0.07, {
        width: 220,
        height: 220,
      }),
      wash: ink("#161a3d", 0.5),
    },
  },
  {
    id: "pastel",
    group: "other",
    unlock: { kind: "free" },
    card: "glass",
    light: {
      ground: "#faf6fa",
      surface: "#ffffff",
      band: "#f3edf4",
      line: "#e9dfee",
      ink: "#1e1724",
      inkMuted: "#5a5063",
      accent: "#b24d84",
      accentInk: "#8e3a68",
      pattern: {
        kind: "blobs",
        inks: [
          ink("#f7b7cf", 0.16),
          ink("#a9e3cf", 0.16),
          ink("#c7c3f2", 0.16),
        ],
      },
    },
    dark: {
      ground: "#141217",
      surface: "#1f1b24",
      band: "#18151c",
      line: "#332c3a",
      ink: "#f2ecf5",
      inkMuted: "#b3a7bb",
      accent: "#e48bbd",
      accentInk: "#eeaacf",
      pattern: {
        kind: "blobs",
        inks: [
          ink("#5a2a3d", 0.22),
          ink("#1f4a3d", 0.22),
          ink("#33305a", 0.22),
        ],
      },
    },
  },
  {
    id: "high-contrast",
    group: "other",
    unlock: { kind: "free" },
    card: "solid",
    light: {
      ground: "#ffffff",
      surface: "#ffffff",
      band: "#ffffff",
      line: "#767676",
      ink: "#000000",
      inkMuted: "#333333",
      accent: "#b33c00",
      accentInk: "#8a2e00",
      pattern: { kind: "none" },
    },
    dark: {
      ground: "#000000",
      surface: "#000000",
      band: "#000000",
      line: "#8a8a8a",
      ink: "#ffffff",
      inkMuted: "#d6d6d6",
      accent: "#ff8c42",
      accentInk: "#ffa366",
      pattern: { kind: "none" },
    },
  },
];

export const findBackground = (id: BackgroundId) =>
  BACKGROUNDS.find((b) => b.id === id);

/** Whether `id` can be chosen with this practice score. */
export function isBackgroundOpen(id: BackgroundId, score: number): boolean {
  const unlock = findBackground(id)?.unlock;
  if (!unlock) return false;
  return (
    unlock.kind === "free" || (unlock.kind === "score" && score >= unlock.at)
  );
}

/** The next background practice opens, and the points still needed. */
export function nextBackground(
  score: number,
): { id: BackgroundId; needed: number } | null {
  const next = BACKGROUNDS.flatMap((b) =>
    b.unlock.kind === "score" && b.unlock.at > score
      ? [{ id: b.id, at: b.unlock.at }]
      : [],
  ).sort((a, b) => a.at - b.at)[0];
  return next ? { id: next.id, needed: next.at - score } : null;
}

/** The `data-bg` value for <html>; the default needs none. */
export const backgroundAttribute = (id: BackgroundId) =>
  id === DEFAULT_BACKGROUND ? null : id;

// ——— CSS (written to app/backgrounds.css) ———

const rgbOf = (color: Hex) => {
  const n = parseInt(color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};

const rgba = ({ color, alpha }: Ink) => {
  const [r, g, b] = rgbOf(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const svgUrl = (svg: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, "%27")}")`;

const grain = ({ color, alpha }: Ink, size = 160) => {
  const [r, g, b] = rgbOf(color).map((c) => +(c / 255).toFixed(3));
  return svgUrl(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 ${alpha} 0'/></filter><rect width='100%' height='100%' filter='url(#g)'/></svg>`,
  );
};

type Layer = {
  image: string;
  size: string;
  position: string;
  repeat: string;
};

/** The pattern's background layers (top first). */
function patternLayers(p: Pattern): Layer[] {
  const tile = (image: string, size: string): Layer => ({
    image,
    size,
    position: "0 0",
    repeat: "repeat",
  });
  const cover = (image: string): Layer => ({
    image,
    size: "100% 100%",
    position: "0 0",
    repeat: "no-repeat",
  });
  switch (p.kind) {
    case "none":
      return [];
    case "lines": {
      const c = rgba(p.ink);
      const size = `${p.size}px ${p.size}px`;
      const rows = tile(
        `linear-gradient(to bottom, ${c} 1px, transparent 1px)`,
        size,
      );
      return p.grid
        ? [
            tile(`linear-gradient(to right, ${c} 1px, transparent 1px)`, size),
            rows,
          ]
        : [rows];
    }
    case "dots":
      return [
        tile(
          `radial-gradient(circle, ${rgba(p.ink)} ${p.radius}px, transparent ${p.radius + 0.5}px)`,
          `${p.size}px ${p.size}px`,
        ),
      ];
    case "grain":
      return [tile(grain(p.ink), "160px 160px")];
    case "blobs": {
      const spots = ["15% 20%", "85% 30%", "50% 90%"];
      return p.inks.map((i, k) =>
        cover(
          `radial-gradient(circle at ${spots[k % spots.length]}, ${rgba(i)}, transparent 45%)`,
        ),
      );
    }
    case "gradient":
      return [cover(`linear-gradient(to bottom, ${p.stops.join(", ")})`)];
    case "svg": {
      const image = svgUrl(p.svg(p.ink.color, p.ink.alpha));
      return p.bottom
        ? [
            {
              image,
              size: `100% ${p.tile.height}px`,
              position: "bottom",
              repeat: "no-repeat",
            },
          ]
        : [tile(image, `${p.tile.width}px ${p.tile.height}px`)];
    }
  }
}

/** A card's shadow for a style and scheme, tinted with the theme's ink. */
export function cardShadow(
  style: CardStyle,
  scheme: "light" | "dark",
  inkColor: Hex,
): string {
  if (style === "solid") return "none";
  const [r, g, b] = rgbOf(inkColor);
  const shade = (a: number) =>
    scheme === "light" ? `rgba(${r}, ${g}, ${b}, ${a})` : `rgba(0, 0, 0, ${a})`;
  if (style === "paper") {
    return scheme === "light"
      ? `0 1px 2px ${shade(0.06)}, 0 2px 8px ${shade(0.04)}`
      : `0 1px 2px ${shade(0.45)}, 0 2px 8px ${shade(0.25)}`;
  }
  const rim =
    scheme === "light"
      ? "inset 0 1px 0 rgba(255, 255, 255, 0.7)"
      : "inset 0 1px 0 rgba(255, 255, 255, 0.06)";
  return `${rim}, 0 8px 24px -12px ${shade(scheme === "light" ? 0.18 : 0.6)}`;
}

/**
 * A drawn texture (an inline SVG) is written once, as a variable on :root,
 * and each selector that shows it refers to the variable.
 */
const textureVar = (b: Background, scheme: "light" | "dark") =>
  `--ll-texture-${b.id}-${scheme}`;

/** A theme's page layers in one scheme: the pattern, then the wash. */
function layersOf(b: Background, scheme: "light" | "dark"): Layer[] {
  const mode = b[scheme];
  const layers = [...patternLayers(mode.pattern)];
  if (mode.wash) {
    layers.push({
      image: `radial-gradient(120% 60% at 50% 0%, ${rgba(mode.wash)}, transparent 70%)`,
      size: "100% 100%",
      position: "0 0",
      repeat: "no-repeat",
    });
  }
  return layers;
}

/** The custom properties a theme sets in one scheme, without the accent. */
function modeDeclarations(
  b: Background,
  scheme: "light" | "dark",
): { base: string[]; accent: string[] } {
  const mode = b[scheme];
  const layers = layersOf(b, scheme);
  const list = (key: keyof Layer, empty: string) =>
    layers.length ? layers.map((l) => l[key]).join(", ") : empty;
  const image = list("image", "none");
  const glass = b.card === "glass";
  return {
    base: [
      `--ll-ground: ${mode.ground};`,
      `--ll-surface: ${mode.surface};`,
      `--ll-band: ${mode.band};`,
      `--ll-line: ${mode.line};`,
      `--ll-ink: ${mode.ink};`,
      `--ll-ink-muted: ${mode.inkMuted};`,
      `--ll-card-alpha: ${glass ? `${Math.round(GLASS_ALPHA[scheme] * 100)}%` : "100%"};`,
      `--ll-card-filter: ${glass ? "blur(12px) saturate(140%)" : "none"};`,
      `--ll-card-texture: ${b.card === "paper" ? `var(--ll-grain-${scheme})` : "none"};`,
      `--ll-shadow-card: ${cardShadow(b.card, scheme, mode.ink)};`,
      `--ll-bg-image: ${image.includes("url(") ? `var(${textureVar(b, scheme)})` : image};`,
      `--ll-bg-size: ${list("size", "auto")};`,
      `--ll-bg-position: ${list("position", "0 0")};`,
      `--ll-bg-repeat: ${list("repeat", "repeat")};`,
    ],
    // A color the learner chose (data-accent, D93) wins over the theme's.
    accent: [
      `--ll-accent: ${mode.accent};`,
      `--ll-accent-ink: ${mode.accentInk};`,
      `--ll-focus: ${mode.accent};`,
    ],
  };
}

const block = (selectors: string[], declarations: string[], indent = "") =>
  `${indent}${selectors.join(`,\n${indent}`)} {\n${declarations
    .map((d) => `${indent}  ${d}`)
    .join("\n")}\n${indent}}`;

/** Both blocks (base and accent) of one theme for `selectors`. */
function themeBlocks(
  b: Background,
  scheme: "light" | "dark",
  selectors: string[],
  indent = "",
): string[] {
  const { base, accent } = modeDeclarations(b, scheme);
  return [
    block(selectors, base, indent),
    block(
      selectors.map((s) => `${s}:not([data-accent])`),
      accent,
      indent,
    ),
  ];
}

/** The whole of app/backgrounds.css. */
export function backgroundCss(): string {
  const parts: string[] = [
    `/*
 * Themes (D121, D166). Written by \`npm run backgrounds:css\` from
 * lib/backgrounds.ts: change that file, not this one. On <html> a theme
 * covers the page; on any element (the picker's previews) just that
 * element. A theme sets the color tokens, the card style
 * (\`surface-card\`), and the page's texture; an accent color the learner
 * chose (\`data-accent\`) wins over the theme's own.
 */`,
    // Drawn textures, written once: paper cards' grain (shared by every
    // paper theme) and each theme's page texture in each scheme.
    block(
      [":root"],
      [
        ...(["light", "dark"] as const).map(
          (scheme) =>
            `--ll-grain-${scheme}: ${grain(PAPER_GRAIN[scheme], 120)};`,
        ),
        ...BACKGROUNDS.flatMap((b) =>
          (["light", "dark"] as const).flatMap((scheme) => {
            const image = layersOf(b, scheme)
              .map((l) => l.image)
              .join(", ");
            return image.includes("url(")
              ? [`${textureVar(b, scheme)}: ${image};`]
              : [];
          }),
        ),
      ],
    ),
  ];
  // The default's block is for previews (on <html> it needs no attribute).
  const moving = BACKGROUNDS.filter((b) => b.motion);
  for (const b of BACKGROUNDS) {
    parts.push(...themeBlocks(b, "light", [`[data-bg="${b.id}"]`]));
  }
  const dark = BACKGROUNDS.flatMap((b) =>
    themeBlocks(
      b,
      "dark",
      [
        `:root:not([data-theme="light"])[data-bg="${b.id}"]`,
        `:root:not([data-theme="light"]) [data-bg="${b.id}"]`,
      ],
      "  ",
    ),
  );
  parts.push(`@media (prefers-color-scheme: dark) {\n${dark.join("\n")}\n}`);
  for (const b of BACKGROUNDS) {
    parts.push(
      ...themeBlocks(b, "dark", [
        `[data-theme="dark"][data-bg="${b.id}"]`,
        `[data-theme="dark"] [data-bg="${b.id}"]`,
      ]),
    );
  }
  // A light preview inside a dark page (the styleguide shows both).
  for (const b of BACKGROUNDS) {
    parts.push(
      ...themeBlocks(b, "light", [
        `:root [data-theme="light"] [data-bg="${b.id}"]`,
      ]),
    );
  }
  parts.push(`/* The page: the texture sits behind everything, fixed. */
html[data-bg] body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-image: var(--ll-bg-image);
  background-size: var(--ll-bg-size);
  background-position: var(--ll-bg-position);
  background-repeat: var(--ll-bg-repeat);
}

/* A preview in the picker shows the same ground and texture. */
.bg-swatch {
  background-color: var(--ll-ground);
  background-image: var(--ll-bg-image, none);
  background-size: var(--ll-bg-size, auto);
  background-position: var(--ll-bg-position, 0 0);
  background-repeat: var(--ll-bg-repeat, repeat);
}

/*
 * Motion: a second layer moves (transform and opacity only, so it runs
 * on the compositor). Still for anyone who asks for less motion.
 */
${moving.map((b) => `html[data-bg="${b.id}"] body::after`).join(",\n")} {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-image: var(--ll-bg-image);
  background-size: var(--ll-bg-size);
  will-change: transform, opacity;
}
${moving
  .filter((b) => b.motion === "twinkle")
  .map((b) => `html[data-bg="${b.id}"] body::after`)
  .join(",\n")} {
  background-position: 110px 70px;
  animation: ll-twinkle 4s ease-in-out infinite alternate;
}
${moving
  .filter((b) => b.motion === "rain")
  .map((b) => `html[data-bg="${b.id}"] body::after`)
  .join(",\n")} {
  inset: -120px 0 0 0;
  background-position: 45px 0;
  animation: ll-rain 1.2s linear infinite;
}
@keyframes ll-twinkle {
  from {
    opacity: 0.2;
  }
  to {
    opacity: 1;
  }
}
@keyframes ll-rain {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    transform: translate3d(-20px, 120px, 0);
  }
}
@media (prefers-reduced-motion: reduce) {
  html[data-bg] body::after {
    animation: none;
  }
}
@media print {
  html[data-bg] body::before,
  html[data-bg] body::after {
    display: none;
  }
}`);
  return `${parts.join("\n\n")}\n`;
}

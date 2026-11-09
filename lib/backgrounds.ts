/**
 * Background themes (D121): the page's ground behind the cards, in light
 * and dark versions, drawn with CSS gradients and small inline SVGs (no
 * image files, nothing copyrighted). Some are free, some open with
 * practice score (like accent colors, D93), and the animated ones have
 * an "unlock forever" fake door.
 *
 * Everything about a background is here; app/backgrounds.css is written
 * from it (`npm run backgrounds:css`, checked by tests/backgrounds.test.ts),
 * and the same test works out every text color's contrast on every color
 * a background can show (its ground, gradient stops, and pattern at full
 * strength).
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

export type BackgroundMode = {
  ground: Hex;
  pattern: Pattern;
  /** Stronger text and line colors (the high-contrast background). */
  ink?: Hex;
  inkMuted?: Hex;
  line?: Hex;
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
  /** Animated (still under prefers-reduced-motion). */
  motion?: Motion;
  light: BackgroundMode;
  dark: BackgroundMode;
};

/** The default ground (app/globals.css). */
export const DEFAULT_GROUNDS = { light: "#fafaf8", dark: "#121212" } as const;

/** "Unlock forever" for an animated background: the price shown. */
export const BACKGROUND_UNLOCK_PRICE = { amount: 60, currency: "TWD" } as const;

const ink = (color: Hex, alpha: number): Ink => ({ color, alpha });

const tree = (c: string, a: number) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><g fill='${c}' fill-opacity='${a}'><path d='M20 70 L32 40 L44 70 Z M24 52 L32 30 L40 52 Z'/><rect x='30' y='70' width='4' height='8'/><path d='M64 86 L74 60 L84 86 Z M67 70 L74 50 L81 70 Z'/><rect x='72' y='86' width='4' height='6'/></g></svg>`;

const wave = (c: string, a: number) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='40'><path d='M0 20 Q15 8 30 20 T60 20 T90 20 T120 20' fill='none' stroke='${c}' stroke-opacity='${a}' stroke-width='2'/></svg>`;

const ridge = (c: string, a: number) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='240' viewBox='0 0 1200 240' preserveAspectRatio='none'><path d='M0 240 L0 150 L140 70 L260 140 L380 40 L520 150 L640 90 L780 160 L900 60 L1040 140 L1200 80 L1200 240 Z' fill='${c}' fill-opacity='${a}'/><path d='M0 240 L0 190 L180 130 L320 190 L470 120 L620 200 L760 140 L920 200 L1080 130 L1200 180 L1200 240 Z' fill='${c}' fill-opacity='${a}'/></svg>`;

const skyline = (c: string, a: number) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='200' viewBox='0 0 1200 200' preserveAspectRatio='none'><path d='M0 200 V120 H60 V80 H110 V130 H160 V60 H220 V110 H260 V40 H320 V120 H370 V90 H430 V140 H480 V70 H540 V100 H600 V30 H650 V120 H700 V80 H770 V130 H820 V50 H880 V110 H930 V90 H990 V140 H1040 V60 H1100 V120 H1150 V100 H1200 V200 Z' fill='${c}' fill-opacity='${a}'/></svg>`;

const beans = (c: string, a: number) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><g fill='none' stroke='${c}' stroke-opacity='${a}' stroke-width='2'><ellipse cx='22' cy='24' rx='9' ry='13' transform='rotate(-30 22 24)'/><path d='M17 15 Q24 24 27 33'/><ellipse cx='60' cy='58' rx='9' ry='13' transform='rotate(25 60 58)'/><path d='M56 48 Q61 58 64 68'/></g></svg>`;

const seigaiha = (c: string, a: number) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='30'><g fill='none' stroke='${c}' stroke-opacity='${a}' stroke-width='1.5'><circle cx='30' cy='30' r='28'/><circle cx='30' cy='30' r='20'/><circle cx='30' cy='30' r='12'/><circle cx='0' cy='15' r='28'/><circle cx='0' cy='15' r='20'/><circle cx='60' cy='15' r='28'/><circle cx='60' cy='15' r='20'/></g></svg>`;

const nordic = (c: string, a: number) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72'><g fill='none' stroke='${c}' stroke-opacity='${a}' stroke-width='2' stroke-linecap='round'><path d='M18 12 V24 M12 18 H24'/><path d='M48 42 L60 54 M60 42 L48 54'/><path d='M14 56 L22 48 L30 56'/><circle cx='54' cy='18' r='5'/></g></svg>`;

const starfield = (c: string, a: number) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><g fill='${c}' fill-opacity='${a}'><circle cx='20' cy='30' r='1.2'/><circle cx='70' cy='12' r='0.8'/><circle cx='120' cy='60' r='1.4'/><circle cx='190' cy='24' r='1'/><circle cx='40' cy='110' r='0.9'/><circle cx='160' cy='120' r='1.2'/><circle cx='95' cy='160' r='1'/><circle cx='200' cy='190' r='0.8'/><circle cx='15' cy='190' r='1.3'/><circle cx='130' cy='205' r='0.7'/></g></svg>`;

const streaks = (c: string, a: number) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='90' height='120'><g stroke='${c}' stroke-opacity='${a}' stroke-width='1.2' stroke-linecap='round'><path d='M10 0 L4 18'/><path d='M50 40 L44 58'/><path d='M80 10 L74 28'/><path d='M30 80 L24 98'/><path d='M70 90 L64 108'/></g></svg>`;

export const BACKGROUNDS: Background[] = [
  {
    id: "default",
    group: "minimal",
    unlock: { kind: "free" },
    light: { ground: DEFAULT_GROUNDS.light, pattern: { kind: "none" } },
    dark: { ground: DEFAULT_GROUNDS.dark, pattern: { kind: "none" } },
  },
  {
    id: "pure",
    group: "minimal",
    unlock: { kind: "free" },
    light: { ground: "#ffffff", pattern: { kind: "none" } },
    dark: { ground: "#000000", pattern: { kind: "none" } },
  },
  {
    id: "warm-gray",
    group: "minimal",
    unlock: { kind: "free" },
    light: { ground: "#f3f1ec", pattern: { kind: "none" } },
    dark: { ground: "#1b1a18", pattern: { kind: "none" } },
  },
  {
    id: "paper",
    group: "paper",
    unlock: { kind: "free" },
    light: {
      ground: "#f8f3e6",
      pattern: { kind: "grain", ink: ink("#7a5c2e", 0.06) },
    },
    dark: {
      ground: "#1a1813",
      pattern: { kind: "grain", ink: ink("#f2e6c8", 0.04) },
    },
  },
  {
    id: "notebook",
    group: "paper",
    unlock: { kind: "score", at: 100 },
    light: {
      ground: "#fbfcfe",
      pattern: {
        kind: "lines",
        ink: ink("#5b7fb5", 0.14),
        size: 28,
        grid: true,
      },
    },
    dark: {
      ground: "#11141a",
      pattern: {
        kind: "lines",
        ink: ink("#8fb0e0", 0.08),
        size: 28,
        grid: true,
      },
    },
  },
  {
    id: "kraft",
    group: "paper",
    unlock: { kind: "score", at: 200 },
    light: {
      ground: "#f5ecdb",
      pattern: { kind: "grain", ink: ink("#6b4a1f", 0.07) },
    },
    dark: {
      ground: "#1d1711",
      pattern: { kind: "grain", ink: ink("#e8cfa4", 0.04) },
    },
  },
  {
    id: "forest",
    group: "nature",
    unlock: { kind: "score", at: 300 },
    light: {
      ground: "#f1f6ef",
      pattern: {
        kind: "svg",
        ink: ink("#2f6b3c", 0.07),
        tile: { width: 96, height: 96 },
        svg: tree,
      },
    },
    dark: {
      ground: "#0e1610",
      pattern: {
        kind: "svg",
        ink: ink("#8fd19e", 0.05),
        tile: { width: 96, height: 96 },
        svg: tree,
      },
    },
  },
  {
    id: "ocean",
    group: "nature",
    unlock: { kind: "score", at: 400 },
    light: {
      ground: "#eff6fa",
      pattern: {
        kind: "svg",
        ink: ink("#2a6f97", 0.1),
        tile: { width: 120, height: 40 },
        svg: wave,
      },
    },
    dark: {
      ground: "#0b141b",
      pattern: {
        kind: "svg",
        ink: ink("#7ec3e6", 0.07),
        tile: { width: 120, height: 40 },
        svg: wave,
      },
    },
  },
  {
    id: "mountain",
    group: "nature",
    unlock: { kind: "score", at: 1100 },
    light: {
      ground: "#f2f4f7",
      pattern: {
        kind: "svg",
        ink: ink("#4a5d78", 0.08),
        tile: { width: 1200, height: 240 },
        svg: ridge,
        bottom: true,
      },
    },
    dark: {
      ground: "#0f1218",
      pattern: {
        kind: "svg",
        ink: ink("#9fb3d1", 0.05),
        tile: { width: 1200, height: 240 },
        svg: ridge,
        bottom: true,
      },
    },
  },
  {
    id: "sunset",
    group: "nature",
    unlock: { kind: "score", at: 1400 },
    light: {
      ground: "#fdf1e7",
      pattern: {
        kind: "gradient",
        stops: ["#fdf1e7", "#fbe9ec", "#f1ecf8"],
      },
    },
    dark: {
      ground: "#1a1018",
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
    light: {
      ground: "#f6efe6",
      pattern: {
        kind: "svg",
        ink: ink("#6f4e37", 0.08),
        tile: { width: 80, height: 80 },
        svg: beans,
      },
    },
    dark: {
      ground: "#17110d",
      pattern: {
        kind: "svg",
        ink: ink("#d9a77c", 0.06),
        tile: { width: 80, height: 80 },
        svg: beans,
      },
    },
  },
  {
    id: "city",
    group: "city",
    unlock: { kind: "paid" },
    light: {
      ground: "#f0f2f6",
      pattern: {
        kind: "svg",
        ink: ink("#3d4a63", 0.08),
        tile: { width: 1200, height: 200 },
        svg: skyline,
        bottom: true,
      },
    },
    dark: {
      ground: "#0c0f17",
      pattern: {
        kind: "svg",
        ink: ink("#8aa0c8", 0.06),
        tile: { width: 1200, height: 200 },
        svg: skyline,
        bottom: true,
      },
    },
  },
  {
    id: "rain",
    group: "city",
    unlock: { kind: "paid" },
    motion: "rain",
    light: {
      ground: "#eef1f4",
      pattern: {
        kind: "svg",
        ink: ink("#4f6b85", 0.07),
        tile: { width: 90, height: 120 },
        svg: streaks,
      },
    },
    dark: {
      ground: "#0d1117",
      pattern: {
        kind: "svg",
        ink: ink("#9db7d1", 0.08),
        tile: { width: 90, height: 120 },
        svg: streaks,
      },
    },
  },
  {
    id: "washi",
    group: "culture",
    unlock: { kind: "score", at: 500 },
    light: {
      ground: "#f7f4ec",
      pattern: {
        kind: "svg",
        ink: ink("#2b4a7a", 0.07),
        tile: { width: 60, height: 30 },
        svg: seigaiha,
      },
    },
    dark: {
      ground: "#0f1320",
      pattern: {
        kind: "svg",
        ink: ink("#9fb6e0", 0.05),
        tile: { width: 60, height: 30 },
        svg: seigaiha,
      },
    },
  },
  {
    id: "retro",
    group: "culture",
    unlock: { kind: "score", at: 900 },
    light: {
      ground: "#f8f1e3",
      pattern: {
        kind: "dots",
        ink: ink("#c08a1e", 0.14),
        size: 32,
        radius: 4,
      },
    },
    dark: {
      ground: "#1a1611",
      pattern: {
        kind: "dots",
        ink: ink("#e0b45a", 0.07),
        size: 32,
        radius: 4,
      },
    },
  },
  {
    id: "nordic",
    group: "culture",
    unlock: { kind: "score", at: 700 },
    light: {
      ground: "#f4f6f5",
      pattern: {
        kind: "svg",
        ink: ink("#3e6b6a", 0.09),
        tile: { width: 72, height: 72 },
        svg: nordic,
      },
    },
    dark: {
      ground: "#121716",
      pattern: {
        kind: "svg",
        ink: ink("#9cc8c6", 0.06),
        tile: { width: 72, height: 72 },
        svg: nordic,
      },
    },
  },
  {
    id: "stars",
    group: "other",
    unlock: { kind: "paid" },
    motion: "twinkle",
    light: {
      ground: "#f5f5fb",
      pattern: {
        kind: "svg",
        ink: ink("#3d3f7a", 0.06),
        tile: { width: 220, height: 220 },
        svg: starfield,
      },
    },
    dark: {
      ground: "#090a16",
      pattern: {
        kind: "svg",
        ink: ink("#ffffff", 0.07),
        tile: { width: 220, height: 220 },
        svg: starfield,
      },
    },
  },
  {
    id: "pastel",
    group: "other",
    unlock: { kind: "free" },
    light: {
      ground: "#fbf7fb",
      pattern: {
        kind: "blobs",
        inks: [
          ink("#f7b7cf", 0.18),
          ink("#a9e3cf", 0.18),
          ink("#c7c3f2", 0.18),
        ],
      },
    },
    dark: {
      ground: "#141217",
      pattern: {
        kind: "blobs",
        inks: [
          ink("#5a2a3d", 0.25),
          ink("#1f4a3d", 0.25),
          ink("#33305a", 0.25),
        ],
      },
    },
  },
  {
    id: "high-contrast",
    group: "other",
    unlock: { kind: "free" },
    light: {
      ground: "#ffffff",
      pattern: { kind: "none" },
      ink: "#000000",
      inkMuted: "#333333",
      line: "#767676",
    },
    dark: {
      ground: "#000000",
      pattern: { kind: "none" },
      ink: "#ffffff",
      inkMuted: "#d6d6d6",
      line: "#8a8a8a",
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

const rgba = ({ color, alpha }: Ink) => {
  const n = parseInt(color.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

const svgUrl = (svg: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, "%27")}")`;

const grain = ({ color, alpha }: Ink) => {
  const n = parseInt(color.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(
    (c) => +(c / 255).toFixed(3),
  );
  return svgUrl(
    `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 ${alpha} 0'/></filter><rect width='100%' height='100%' filter='url(#g)'/></svg>`,
  );
};

/** The custom properties a background sets in one mode. */
function modeDeclarations(mode: BackgroundMode): string[] {
  const p = mode.pattern;
  const out = [`--ll-ground: ${mode.ground};`];
  if (mode.ink) out.push(`--ll-ink: ${mode.ink};`);
  if (mode.inkMuted) out.push(`--ll-ink-muted: ${mode.inkMuted};`);
  if (mode.line) out.push(`--ll-line: ${mode.line};`);
  let image = "none";
  let size = "auto";
  let position = "0 0";
  let repeat = "repeat";
  switch (p.kind) {
    case "none":
      break;
    case "lines": {
      const c = rgba(p.ink);
      image = p.grid
        ? `linear-gradient(to right, ${c} 1px, transparent 1px), linear-gradient(to bottom, ${c} 1px, transparent 1px)`
        : `linear-gradient(to bottom, ${c} 1px, transparent 1px)`;
      size = `${p.size}px ${p.size}px`;
      break;
    }
    case "dots":
      image = `radial-gradient(circle, ${rgba(p.ink)} ${p.radius}px, transparent ${p.radius + 0.5}px)`;
      size = `${p.size}px ${p.size}px`;
      break;
    case "grain":
      image = grain(p.ink);
      size = "160px 160px";
      break;
    case "blobs": {
      const spots = ["15% 20%", "85% 30%", "50% 90%"];
      image = p.inks
        .map(
          (i, k) =>
            `radial-gradient(circle at ${spots[k % spots.length]}, ${rgba(i)}, transparent 45%)`,
        )
        .join(", ");
      size = "100% 100%";
      repeat = "no-repeat";
      break;
    }
    case "gradient":
      image = `linear-gradient(to bottom, ${p.stops.join(", ")})`;
      size = "100% 100%";
      repeat = "no-repeat";
      break;
    case "svg":
      image = svgUrl(p.svg(p.ink.color, p.ink.alpha));
      if (p.bottom) {
        size = `100% ${p.tile.height}px`;
        position = "bottom";
        repeat = "no-repeat";
      } else {
        size = `${p.tile.width}px ${p.tile.height}px`;
      }
      break;
  }
  out.push(
    `--ll-bg-image: ${image};`,
    `--ll-bg-size: ${size};`,
    `--ll-bg-position: ${position};`,
    `--ll-bg-repeat: ${repeat};`,
  );
  return out;
}

const block = (selectors: string[], declarations: string[], indent = "") =>
  `${indent}${selectors.join(`,\n${indent}`)} {\n${declarations
    .map((d) => `${indent}  ${d}`)
    .join("\n")}\n${indent}}`;

/** The whole of app/backgrounds.css. */
export function backgroundCss(): string {
  const parts: string[] = [
    `/*
 * Background themes (D121). Written by \`npm run backgrounds:css\` from
 * lib/backgrounds.ts: change that file, not this one. On <html> a
 * background covers the page; on any element (the picker's swatches) just
 * that element. Cards, inputs, and buttons keep their own surface colors.
 */`,
  ];
  // The default's block is for swatches (on <html> it needs no attribute).
  const listed = BACKGROUNDS;
  const moving = BACKGROUNDS.filter((b) => b.motion);
  for (const b of listed) {
    parts.push(block([`[data-bg="${b.id}"]`], modeDeclarations(b.light)));
  }
  const dark = listed.map((b) =>
    block(
      [
        `:root:not([data-theme="light"])[data-bg="${b.id}"]`,
        `:root:not([data-theme="light"]) [data-bg="${b.id}"]`,
      ],
      modeDeclarations(b.dark),
      "  ",
    ),
  );
  parts.push(`@media (prefers-color-scheme: dark) {\n${dark.join("\n")}\n}`);
  for (const b of listed) {
    parts.push(
      block(
        [
          `[data-theme="dark"][data-bg="${b.id}"]`,
          `[data-theme="dark"] [data-bg="${b.id}"]`,
        ],
        modeDeclarations(b.dark),
      ),
    );
  }
  // A light swatch inside system dark mode (the picker shows both).
  for (const b of listed) {
    parts.push(
      block(
        [`:root [data-theme="light"] [data-bg="${b.id}"]`],
        modeDeclarations(b.light),
      ),
    );
  }
  parts.push(`/* The page: the pattern sits behind everything, fixed. */
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

/* A swatch in the picker shows the same ground and pattern. */
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

// ——— Contrast (tests/backgrounds.test.ts) ———

/** Every color text may sit on in one mode: ground, stops, pattern. */
export function groundsOf(mode: BackgroundMode, motion = false): Hex[] {
  const p = mode.pattern;
  const over = ({ color, alpha }: Ink, base: Hex): Hex => {
    const a = parseInt(color.slice(1), 16);
    const b = parseInt(base.slice(1), 16);
    const mix = (shift: number) =>
      Math.round(
        ((a >> shift) & 255) * alpha + ((b >> shift) & 255) * (1 - alpha),
      );
    return `#${[16, 8, 0]
      .map((s) => mix(s).toString(16).padStart(2, "0"))
      .join("")}` as Hex;
  };
  switch (p.kind) {
    case "none":
      return [mode.ground];
    case "gradient":
      return [mode.ground, ...p.stops];
    case "blobs":
      // Where the blobs overlap, every one at full strength.
      return [
        mode.ground,
        p.inks.reduce<Hex>((c, i) => over(i, c), mode.ground),
      ];
    default:
      // A motion layer draws a second copy over the first.
      return [
        mode.ground,
        motion
          ? over(p.ink, over(p.ink, mode.ground))
          : over(p.ink, mode.ground),
      ];
  }
}

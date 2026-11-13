/**
 * Contrast of every theme (D166): which text and button colors sit on
 * which colors, worked out from lib/backgrounds.ts. Used by
 * tests/theme-contrast.test.ts (WCAG 2.1 AA) and `npm run themes:contrast`
 * (a table for reviews).
 */
import {
  GLASS_ALPHA,
  PAPER_GRAIN,
  type Background,
  type BackgroundMode,
  type Hex,
  type Ink,
} from "./backgrounds.ts";

export type Scheme = "light" | "dark";

type RGB = [number, number, number];

const rgb = (value: Hex): RGB => [
  parseInt(value.slice(1, 3), 16),
  parseInt(value.slice(3, 5), 16),
  parseInt(value.slice(5, 7), 16),
];

const toHex = (c: RGB): Hex =>
  `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}` as Hex;

/** `top` at `alpha` laid over `base`. */
export function over({ color, alpha }: Ink, base: Hex): Hex {
  const a = rgb(color);
  const b = rgb(base);
  return toHex(a.map((c, i) => c * alpha + b[i] * (1 - alpha)) as RGB);
}

const luminance = (hex: Hex) => {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/** WCAG 2.1 contrast ratio. */
export function contrast(a: Hex, b: Hex): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Every color the page ground can show in one scheme: the ground, the
 * gradient stops, and the wash and pattern at full strength (a motion
 * layer draws a second copy of the pattern over the first).
 */
export function groundsOf(mode: BackgroundMode, motion = false): Hex[] {
  const base = mode.wash
    ? [mode.ground, over(mode.wash, mode.ground)]
    : [mode.ground];
  const p = mode.pattern;
  switch (p.kind) {
    case "none":
      return base;
    case "gradient":
      return [...base, ...p.stops];
    case "blobs":
      // Where the blobs overlap, every one at full strength.
      return [
        ...base,
        ...base.map((g) => p.inks.reduce<Hex>((c, i) => over(i, c), g)),
      ];
    default:
      return [
        ...base,
        ...base.map((g) =>
          motion ? over(p.ink, over(p.ink, g)) : over(p.ink, g),
        ),
      ];
  }
}

/** The plain grounds (no pattern lines): where non-text colors must show. */
export function plainGroundsOf(mode: BackgroundMode): Hex[] {
  const base = mode.wash
    ? [mode.ground, over(mode.wash, mode.ground)]
    : [mode.ground];
  return mode.pattern.kind === "gradient"
    ? [...base, ...mode.pattern.stops]
    : base;
}

/** Every color a card (`surface-card`) can show over this theme's ground. */
export function cardsOf(
  b: Background,
  scheme: Scheme,
  grounds: Hex[] = groundsOf(b[scheme], !!b.motion),
): Hex[] {
  const mode = b[scheme];
  if (b.card === "glass") {
    const alpha = GLASS_ALPHA[scheme];
    return grounds.map((g) => over({ color: mode.surface, alpha }, g));
  }
  if (b.card === "paper") {
    return [mode.surface, over(PAPER_GRAIN[scheme], mode.surface)];
  }
  return [mode.surface];
}

/** How strongly a primary button tints its background (Button.tsx). */
export const PRIMARY_TINT = { rest: 0.14, hover: 0.22 } as const;

export type Pair = {
  /** e.g. "ink on card", "primary button text on hover". */
  what: string;
  fg: Hex;
  bg: Hex;
  ratio: number;
  /** 4.5 for text, 3 for lines, fills, and the focus ring. */
  min: number;
};

/**
 * Every text and non-text pair one scheme of a theme shows. `status` is
 * the success and error colors (app/globals.css); `accents` are the
 * colors a learner may choose instead of the theme's (D93).
 */
export function contrastPairs(
  b: Background,
  scheme: Scheme,
  status: { success: Hex; error: Hex },
  accents: { id: string; accent: Hex; accentInk: Hex }[] = [],
): Pair[] {
  const mode = b[scheme];
  const grounds = groundsOf(mode, !!b.motion);
  const cards = cardsOf(b, scheme);
  const backs = [
    ...grounds.map((c) => ({ on: "ground", c })),
    ...cards.map((c) => ({ on: "card", c })),
    { on: "input", c: mode.surface },
  ];
  const pairs: Pair[] = [];
  const add = (what: string, fg: Hex, bg: Hex, min: number) =>
    pairs.push({ what, fg, bg, ratio: contrast(fg, bg), min });

  const palettes = [
    { id: "theme", accent: mode.accent, accentInk: mode.accentInk },
    ...accents,
  ];
  for (const { on, c } of backs) {
    add(`ink on ${on}`, mode.ink, c, 4.5);
    add(`muted text on ${on}`, mode.inkMuted, c, 4.5);
    add(`success on ${on}`, status.success, c, 4.5);
    add(`error on ${on}`, status.error, c, 4.5);
    for (const p of palettes) {
      add(`accent text (${p.id}) on ${on}`, p.accentInk, c, 4.5);
    }
  }
  // Buttons blur what's under them (backdrop-blur), so pattern lines melt
  // into the ground: tints and lines are checked on plain grounds and cards.
  const plain = plainGroundsOf(mode);
  const plainBacks = [
    ...plain.map((c) => ({ on: "ground", c })),
    ...cardsOf(b, scheme, plain).map((c) => ({ on: "card", c })),
  ];
  for (const { on, c } of plainBacks) {
    // A secondary button: ink on its 8% ink tint (hover).
    add(
      `secondary button text on ${on}`,
      mode.ink,
      over({ color: mode.ink, alpha: 0.08 }, c),
      4.5,
    );
    for (const p of palettes) {
      for (const [state, alpha] of Object.entries(PRIMARY_TINT)) {
        add(
          `primary button text (${p.id}, ${state}) on ${on}`,
          p.accentInk,
          over({ color: p.accent, alpha }, c),
          4.5,
        );
      }
      // Non-text (WCAG 1.4.11): the focus ring and the button's border.
      add(`accent line (${p.id}) on ${on}`, p.accent, c, 3);
    }
  }
  return pairs;
}

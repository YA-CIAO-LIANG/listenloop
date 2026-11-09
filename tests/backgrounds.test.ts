import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BACKGROUND_GROUPS,
  BACKGROUNDS,
  backgroundAttribute,
  backgroundCss,
  groundsOf,
  isBackgroundOpen,
  nextBackground,
  type Hex,
} from "@/lib/backgrounds";
import { ACCENTS } from "@/lib/accents";
import { BACKGROUND_IDS } from "@/lib/background-ids";
import en from "@/messages/en.json";
import zh from "@/messages/zh-Hant.json";

const css = readFileSync("app/globals.css", "utf8");

type RGB = [number, number, number];
const hex = (value: string): RGB => [
  parseInt(value.slice(1, 3), 16),
  parseInt(value.slice(3, 5), 16),
  parseInt(value.slice(5, 7), 16),
];
const luminance = ([r, g, b]: RGB) => {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(hex(a)), luminance(hex(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** A token's value in a CSS block (the first block for `selector`). */
function token(selector: string, name: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  const body = css.slice(start, css.indexOf("}", start));
  return body.match(new RegExp(`--ll-${name}: (#[0-9a-f]{6})`))![1];
}

const MODES = {
  light: {
    selector: '[data-theme="light"]',
    accent: (id: string) => `[data-accent="${id}"]`,
  },
  dark: {
    selector: '[data-theme="dark"]',
    accent: (id: string) => `[data-theme="dark"] [data-accent="${id}"]`,
  },
} as const;

describe("background themes (D121)", () => {
  it("has at least 12, each with a name in both languages", () => {
    expect(BACKGROUNDS.length).toBeGreaterThanOrEqual(13);
    const ids = BACKGROUNDS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const b of BACKGROUNDS) {
      expect(BACKGROUND_GROUPS).toContain(b.group);
      expect(zh.backgrounds.names).toHaveProperty(b.id);
      expect(en.backgrounds.names).toHaveProperty(b.id);
    }
    expect(ids).toEqual([...BACKGROUND_IDS]);
    // Free, score, and paid ones all exist.
    for (const kind of ["free", "score", "paid"]) {
      expect(BACKGROUNDS.some((b) => b.unlock.kind === kind)).toBe(true);
    }
  });

  for (const b of BACKGROUNDS) {
    it(`${b.id}: every text color passes AA in light and dark`, () => {
      for (const [name, mode] of Object.entries(MODES)) {
        const own = b[name as "light" | "dark"];
        const ink = own.ink ?? token(mode.selector, "ink");
        const muted = own.inkMuted ?? token(mode.selector, "ink-muted");
        const texts: [string, string][] = [
          ["ink", ink],
          ["ink-muted", muted],
          ["success", token(mode.selector, "success")],
          ["error", token(mode.selector, "error")],
          ...ACCENTS.map(
            (a) =>
              [
                `accent-ink ${a.id}`,
                token(mode.accent(a.id), "accent-ink"),
              ] as [string, string],
          ),
        ];
        const plain =
          own.pattern.kind === "gradient"
            ? [own.ground, ...own.pattern.stops]
            : [own.ground];
        for (const ground of groundsOf(own, !!b.motion)) {
          for (const [what, color] of texts) {
            expect(
              contrast(color, ground),
              `${b.id} ${name} ${what} on ${ground}`,
            ).toBeGreaterThanOrEqual(4.5);
          }
          // The focus ring and button borders (non-text, WCAG 1.4.11): on the
          // ground and gradient stops; patterns are thin decorative lines.
          if (!plain.includes(ground)) continue;
          for (const a of ACCENTS) {
            const accent = token(mode.accent(a.id), "accent");
            expect(
              contrast(accent, ground),
              `${b.id} ${name} accent ${a.id} on ${ground}`,
            ).toBeGreaterThanOrEqual(3);
          }
        }
      }
    });
  }

  it("app/backgrounds.css is written from lib/backgrounds.ts", () => {
    expect(readFileSync("app/backgrounds.css", "utf8")).toBe(backgroundCss());
  });

  it("animated backgrounds stand still for reduced motion", () => {
    const generated = backgroundCss();
    expect(BACKGROUNDS.some((b) => b.motion)).toBe(true);
    expect(generated).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*html\[data-bg\] body::after \{\s*animation: none;/,
    );
    // Only transform and opacity move (no layout or repaint per frame).
    const keyframes = generated.match(/@keyframes[^@]*/g) ?? [];
    for (const frame of keyframes) {
      expect(frame).not.toMatch(/background-position|top:|left:|width|height/);
    }
  });

  it("opens with practice score, in order", () => {
    expect(isBackgroundOpen("default", 0)).toBe(true);
    expect(isBackgroundOpen("high-contrast", 0)).toBe(true);
    expect(isBackgroundOpen("notebook", 99)).toBe(false);
    expect(isBackgroundOpen("notebook", 100)).toBe(true);
    // Paid ones are a fake door: never open by score.
    expect(isBackgroundOpen("stars", 1_000_000)).toBe(false);
    expect(nextBackground(150)).toEqual({ id: "kraft", needed: 50 });
    expect(nextBackground(1_000_000)).toBeNull();
    expect(backgroundAttribute("default")).toBeNull();
    expect(backgroundAttribute("forest")).toBe("forest");
  });

  it("uses no image files: only gradients and inline SVG", () => {
    const outside = backgroundCss().replace(
      /url\("data:image\/svg\+xml,[^"]*"\)/g,
      "",
    );
    expect(outside).not.toMatch(/url\(/);
  });
});

export type { Hex };

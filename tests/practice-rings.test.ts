import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BACKGROUNDS, type Hex } from "@/lib/backgrounds";
import {
  hoursAndMinutes,
  PRACTICE_RINGS,
  ringLevel,
} from "@/lib/practice-rings";
import { RING_CLASS } from "@/components/practice-rings";
import { cardsOf, contrast, type Scheme } from "@/lib/theme-contrast";

const css = readFileSync("app/globals.css", "utf8");

/** A token's value in the block that starts with `selector {`. */
function token(selector: string, name: string): Hex {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("}", start));
  return body.match(new RegExp(`--ll-${name}: (#[0-9a-f]{6})`))![1] as Hex;
}

const SELECTOR = {
  light: '[data-theme="light"]',
  dark: '[data-theme="dark"]',
} as const;

describe("practice-time rings (D181)", () => {
  it("steps up at 15 min, 30 min, 1 h, 2 h, 3 h", () => {
    expect(PRACTICE_RINGS.map((r) => r.minMinutes)).toEqual([
      15, 30, 60, 120, 180,
    ]);
    expect(ringLevel(0)).toBe(0);
    expect(ringLevel(14)).toBe(0);
    expect(ringLevel(15)).toBe(1);
    expect(ringLevel(29)).toBe(1);
    expect(ringLevel(30)).toBe(2);
    expect(ringLevel(59)).toBe(2);
    expect(ringLevel(60)).toBe(3);
    expect(ringLevel(120)).toBe(4);
    expect(ringLevel(179)).toBe(4);
    expect(ringLevel(180)).toBe(5);
    expect(ringLevel(600)).toBe(5);
  });

  it("gets thicker with time, not only another color", () => {
    const widths = PRACTICE_RINGS.map(({ level }) => {
      const width = RING_CLASS[level].match(/border-(\[([\d.]+)px\]|(\d))/)!;
      return Number(width[2] ?? width[3]);
    });
    expect(widths).toEqual([1, 1.5, 2, 3, 4]);
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeGreaterThan(widths[i - 1]);
    }
    // Each ring has its own color; 30 minutes is the accent.
    const colors = PRACTICE_RINGS.map(
      ({ level }) => RING_CLASS[level].match(/border-(practice-\d)/)![1],
    );
    expect(new Set(colors).size).toBe(5);
    expect(css).toContain("--color-practice-2: var(--ll-accent);");
  });

  it("says minutes as hours and minutes", () => {
    expect(hoursAndMinutes(72)).toEqual({ hours: 1, minutes: 12 });
    expect(hoursAndMinutes(120)).toEqual({ hours: 2, minutes: 0 });
    expect(hoursAndMinutes(14.6)).toEqual({ hours: 0, minutes: 15 });
  });

  // WCAG 1.4.11: a ring is a graphic that conveys meaning, so ≥ 3:1. It
  // sits between two gaps of the card's color (the practice-ring utility),
  // so it's checked against every card and surface color of every theme,
  // light and dark. The accent ring (30 min) is checked with every theme
  // and chosen accent by tests/theme-contrast.test.ts ("accent line").
  for (const scheme of ["light", "dark"] as Scheme[]) {
    for (const b of BACKGROUNDS) {
      it(`${b.id} (${scheme}): every ring is ≥ 3:1`, () => {
        const backs = [...cardsOf(b, scheme), b[scheme].surface];
        const failing = [1, 3, 4, 5].flatMap((level) => {
          const ring = token(SELECTOR[scheme], `practice-${level}`);
          return backs
            .map((bg) => ({ bg, ratio: contrast(ring, bg) }))
            .filter(({ ratio }) => ratio < 3)
            .map(
              ({ bg, ratio }) =>
                `ring ${level} ${ring} on ${bg} = ${ratio.toFixed(2)}`,
            );
        });
        expect(failing).toEqual([]);
      });
    }
  }

  it("has the same dark colors with and without the system setting", () => {
    const media = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"));
    for (const level of [1, 3, 4, 5]) {
      const system = media.match(
        new RegExp(`--ll-practice-${level}: (#[0-9a-f]{6})`),
      )![1];
      expect(system).toBe(token(SELECTOR.dark, `practice-${level}`));
    }
  });
});

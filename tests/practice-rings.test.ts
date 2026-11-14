import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BACKGROUNDS, type Hex } from "@/lib/backgrounds";
import {
  hoursAndMinutes,
  PRACTICE_RINGS,
  ringLevel,
} from "@/lib/practice-rings";
import { GLOW, glowStyle } from "@/components/practice-rings";
import { cardsOf, contrast, over, type Scheme } from "@/lib/theme-contrast";

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

const LEVELS = PRACTICE_RINGS.map((r) => r.level);

describe("practice-time levels (D181)", () => {
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

  it("says minutes as hours and minutes", () => {
    expect(hoursAndMinutes(72)).toEqual({ hours: 1, minutes: 12 });
    expect(hoursAndMinutes(120)).toEqual({ hours: 2, minutes: 0 });
    expect(hoursAndMinutes(14.6)).toEqual({ hours: 0, minutes: 15 });
  });
});

describe("the yellow glow (D183)", () => {
  it("gets brighter and wider with time, not only another shade", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const [a, b] = [GLOW[LEVELS[i - 1]], GLOW[LEVELS[i]]];
      expect(b.strength).toBeGreaterThan(a.strength);
      expect(b.blur).toBeGreaterThan(a.blur);
      expect(b.spread).toBeGreaterThan(a.spread);
    }
    expect(GLOW[5].strength).toBe(100);
  });

  it("draws one token, scaled down for the legend", () => {
    expect(glowStyle(3).boxShadow).toBe(
      "0 0 8px 2px color-mix(in srgb, var(--ll-glow) 65%, transparent)",
    );
    expect(glowStyle(5, 0.5).boxShadow).toBe(
      "0 0 6px 2px color-mix(in srgb, var(--ll-glow) 100%, transparent)",
    );
  });

  // A glow is soft by design, so it can't be the only way to tell the
  // time (WCAG 1.4.1): the label, tooltip, and selected day's line say it
  // in words. What it must do on every card of every theme, light and
  // dark: stand out more at each level (brighter = more), and the
  // brightest stand out clearly.
  for (const scheme of ["light", "dark"] as Scheme[]) {
    for (const b of BACKGROUNDS) {
      it(`${b.id} (${scheme}): each level stands out more than the last`, () => {
        const glow = token(SELECTOR[scheme], "glow");
        const failing = [...cardsOf(b, scheme), b[scheme].surface].flatMap(
          (card) => {
            const ratios = LEVELS.map((level) =>
              contrast(
                over({ color: glow, alpha: GLOW[level].strength / 100 }, card),
                card,
              ),
            );
            const problems: string[] = [];
            for (let i = 1; i < ratios.length; i++) {
              if (ratios[i] <= ratios[i - 1]) {
                problems.push(`level ${i + 1} not brighter on ${card}`);
              }
            }
            if (ratios[4] < 1.6) {
              problems.push(`level 5 ${ratios[4].toFixed(2)}:1 on ${card}`);
            }
            return problems;
          },
        );
        expect(failing).toEqual([]);
      });
    }
  }

  it("has the same dark glow with and without the system setting", () => {
    const media = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"));
    expect(media.match(/--ll-glow: (#[0-9a-f]{6})/)![1]).toBe(
      token(SELECTOR.dark, "glow"),
    );
  });
});

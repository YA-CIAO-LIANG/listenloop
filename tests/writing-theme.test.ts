import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BACKGROUNDS, type Hex } from "@/lib/backgrounds";
import { DEFICIENCIES, deltaE, simulate } from "@/lib/color-vision";
import { PRACTICE_RINGS } from "@/lib/practice-rings";
import { GLOW } from "@/components/practice-rings";
import { HEAT_TEXT } from "@/components/heat-colors";
import { cardsOf, contrast, over, type Scheme } from "@/lib/theme-contrast";

const css = readFileSync("app/globals.css", "utf8");

/** A token's value in the block that starts with `selector {`. */
function token(selector: string, name: string, from = 0): Hex {
  const start = css.indexOf(`${selector} {`, from);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  const body = css.slice(start, css.indexOf("}", start));
  const found = body.match(new RegExp(`--ll-${name}: (#[0-9a-f]{6})`));
  expect(found, `${selector} --ll-${name}`).not.toBeNull();
  return found![1] as Hex;
}

const WRITING = {
  light: '[data-area="writing"]',
  dark: '[data-theme="dark"] [data-area="writing"]',
} as const;
const LISTENING = {
  light: '[data-theme="light"]',
  dark: '[data-theme="dark"]',
} as const;
const TEAL = {
  light: '[data-accent="teal"]',
  dark: '[data-theme="dark"] [data-accent="teal"]',
} as const;

const writing = (scheme: Scheme, name: string) => token(WRITING[scheme], name);
const SCHEMES: Scheme[] = ["light", "dark"];
const LEVELS = PRACTICE_RINGS.map((r) => r.level);

/**
 * The writing area's teal (D217): its own accent, heat steps, and glow,
 * readable on every theme in light and dark (WCAG AA), and told apart
 * from listening's orange with any color vision.
 */
describe("writing theme (D217)", () => {
  for (const scheme of SCHEMES) {
    it(`uses the teal a learner may choose (${scheme}), so the theme-contrast tests cover it`, () => {
      for (const name of ["accent", "accent-ink", "focus"]) {
        expect(writing(scheme, name)).toBe(token(TEAL[scheme], name));
      }
    });
  }

  it("has the same dark colors with and without the system setting", () => {
    const media = css.indexOf(
      ':root:not([data-theme="light"]) [data-area="writing"]',
    );
    expect(media).toBeGreaterThan(0);
    for (const name of [
      "accent",
      "accent-ink",
      "heat-1",
      "heat-2",
      "heat-3",
      "heat-4",
      "heat-ink-strong",
      "glow",
    ]) {
      expect(
        token(':root:not([data-theme="light"]) [data-area="writing"]', name),
      ).toBe(writing("dark", name));
    }
  });

  for (const scheme of SCHEMES) {
    for (const b of BACKGROUNDS) {
      it(`${b.id} (${scheme}): date numbers pass AA on every heat step`, () => {
        const failing: string[] = [];
        for (const level of [1, 2, 3, 4] as const) {
          const fill = writing(scheme, `heat-${level}`);
          const ink =
            HEAT_TEXT[level] === "text-heat-ink-strong"
              ? writing(scheme, "heat-ink-strong")
              : b[scheme].ink;
          const ratio = contrast(ink, fill);
          if (ratio < 4.5) {
            failing.push(
              `step ${level}: ${ink} on ${fill} ${ratio.toFixed(2)}`,
            );
          }
        }
        expect(failing).toEqual([]);
      });

      it(`${b.id} (${scheme}): the teal glow stands out more at each level`, () => {
        const glow = writing(scheme, "glow");
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

  it("the heat steps get darker (light) or brighter (dark) step by step", () => {
    for (const scheme of SCHEMES) {
      const ground = scheme === "light" ? "#ffffff" : "#121212";
      const ratios = [1, 2, 3, 4].map((l) =>
        contrast(writing(scheme, `heat-${l}`), ground as Hex),
      );
      for (let i = 1; i < ratios.length; i++) {
        expect(ratios[i]).toBeGreaterThan(ratios[i - 1]);
      }
    }
  });

  // ΔE 20 or more reads as clearly different colors; every pair is far
  // above it, so the color never has to be the only cue (the tabs and
  // titles also say "Listening" or "Writing").
  for (const scheme of SCHEMES) {
    for (const [name, a, b] of [
      ["accent", token(LISTENING[scheme], "accent"), writing(scheme, "accent")],
      [
        "accent text",
        token(LISTENING[scheme], "accent-ink"),
        writing(scheme, "accent-ink"),
      ],
      [
        "darkest heat step",
        token(LISTENING[scheme], "heat-4"),
        writing(scheme, "heat-4"),
      ],
      ["glow", token(LISTENING[scheme], "glow"), writing(scheme, "glow")],
    ] as const) {
      it(`listening and writing ${name} stay apart with every color vision (${scheme})`, () => {
        expect(deltaE(a, b)).toBeGreaterThan(30);
        for (const d of DEFICIENCIES) {
          expect(
            deltaE(simulate(a, d), simulate(b, d)),
            `${d}: ${simulate(a, d)} vs ${simulate(b, d)}`,
          ).toBeGreaterThan(30);
        }
      });
    }
  }

  it("simulates known colors like the published matrices", () => {
    // Pure red is seen as a dark olive with protanopia and keeps red with
    // tritanopia; white stays white for everyone.
    expect(simulate("#ffffff" as Hex, "protanopia")).toBe("#ffffff");
    expect(simulate("#ffffff" as Hex, "tritanopia")).toBe("#ffffff");
    const red = simulate("#ff0000" as Hex, "protanopia");
    expect(parseInt(red.slice(1, 3), 16)).toBeLessThan(150);
    expect(deltaE("#000000" as Hex, "#ffffff" as Hex)).toBeCloseTo(100, 0);
  });
});

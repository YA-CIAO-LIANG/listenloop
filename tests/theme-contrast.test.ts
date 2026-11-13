import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACCENTS, DEFAULT_ACCENT } from "@/lib/accents";
import { BACKGROUNDS, type Hex } from "@/lib/backgrounds";
import {
  cardsOf,
  contrast,
  contrastPairs,
  groundsOf,
  type Scheme,
} from "@/lib/theme-contrast";

const css = readFileSync("app/globals.css", "utf8");

function token(selector: string, name: string): Hex {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  const body = css.slice(start, css.indexOf("}", start));
  return body.match(new RegExp(`--ll-${name}: (#[0-9a-f]{6})`))![1] as Hex;
}

const SELECTORS = {
  light: {
    base: '[data-theme="light"]',
    accent: (id: string) => `[data-accent="${id}"]`,
  },
  dark: {
    base: '[data-theme="dark"]',
    accent: (id: string) => `[data-theme="dark"] [data-accent="${id}"]`,
  },
} as const;

/** The learner's own colors (D93); orange, the default, follows the theme. */
const chosenAccents = (scheme: Scheme) =>
  ACCENTS.filter(({ id }) => id !== DEFAULT_ACCENT).map(({ id }) => ({
    id,
    accent: token(SELECTORS[scheme].accent(id), "accent"),
    accentInk: token(SELECTORS[scheme].accent(id), "accent-ink"),
  }));

/**
 * WCAG 2.1 AA for every theme in light and dark (D166): text, muted text,
 * accent text, success and error on the ground (with its texture at full
 * strength), on cards (glass cards over every ground color, paper cards
 * with their grain), and on inputs; primary and secondary button text on
 * their tints, at rest and on hover; and the accent itself (focus ring,
 * button border) at 3:1. With the theme's own accent and with every color
 * a learner may choose instead.
 */
describe("theme contrast (WCAG AA, D166)", () => {
  it("contrast() matches WCAG's examples", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#767676", "#ffffff")).toBeGreaterThan(4.5);
    expect(contrast("#777777", "#ffffff")).toBeLessThan(4.5);
  });

  for (const b of BACKGROUNDS) {
    for (const scheme of ["light", "dark"] as Scheme[]) {
      it(`${b.id} (${scheme}) passes AA`, () => {
        const pairs = contrastPairs(
          b,
          scheme,
          {
            success: token(SELECTORS[scheme].base, "success"),
            error: token(SELECTORS[scheme].base, "error"),
          },
          chosenAccents(scheme),
        );
        // Every kind of pair is checked for this theme.
        for (const kind of [
          "ink on ground",
          "ink on card",
          "muted text on ground",
          "muted text on card",
          "accent text (theme) on card",
          "primary button text (theme, rest) on card",
          "primary button text (theme, hover) on ground",
          "secondary button text on card",
          "accent line (theme) on card",
        ]) {
          expect(
            pairs.some((p) => p.what === kind),
            kind,
          ).toBe(true);
        }
        const failing = pairs
          .filter((p) => p.ratio < p.min)
          .map(
            (p) =>
              `${p.what}: ${p.fg} on ${p.bg} = ${p.ratio.toFixed(2)} (< ${p.min})`,
          );
        expect(failing).toEqual([]);
      });
    }
  }

  it("glass cards are worked out over every color of the ground", () => {
    const glass = BACKGROUNDS.find((b) => b.card === "glass")!;
    expect(cardsOf(glass, "light")).toHaveLength(
      groundsOf(glass.light, !!glass.motion).length,
    );
  });
});

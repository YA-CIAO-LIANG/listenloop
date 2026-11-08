import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ACCENTS,
  accentAttribute,
  isAccentId,
  isUnlocked,
  nextUnlock,
} from "@/lib/accents";

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
const contrast = (a: RGB, b: RGB) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** `top` at `alpha` over `bottom` (a primary button's bg-accent/14). */
const over = (top: RGB, bottom: RGB, alpha: number): RGB =>
  top.map((c, i) => Math.round(c * alpha + bottom[i] * (1 - alpha))) as RGB;

function tokens(selector: string) {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  const body = css.slice(start, css.indexOf("}", start));
  const value = (name: string) =>
    hex(body.match(new RegExp(`--ll-${name}: (#[0-9a-f]{6})`))![1]);
  return { accent: value("accent"), ink: value("accent-ink") };
}

const LIGHT = { ground: hex("#fafaf8"), surface: hex("#ffffff") };
const DARK = { ground: hex("#121212"), surface: hex("#1c1c1c") };

describe("accent colors (D93)", () => {
  it.each(ACCENTS.map((a) => a.id))(
    "%s passes AA in light and dark mode",
    (id) => {
      const modes = [
        { theme: LIGHT, colors: tokens(`[data-accent="${id}"]`) },
        {
          theme: DARK,
          colors: tokens(`[data-theme="dark"] [data-accent="${id}"]`),
        },
      ];
      for (const { theme, colors } of modes) {
        const tint = over(colors.accent, theme.surface, 0.14);
        for (const background of [theme.ground, theme.surface, tint]) {
          expect(contrast(colors.ink, background)).toBeGreaterThanOrEqual(4.5);
        }
        // Lines and fills (non-text, WCAG 1.4.11).
        expect(contrast(colors.accent, theme.ground)).toBeGreaterThanOrEqual(3);
      }
      // System dark mode uses the same colors as the explicit choice.
      expect(
        tokens(`  :root:not([data-theme="light"]) [data-accent="${id}"]`),
      ).toEqual(tokens(`[data-theme="dark"] [data-accent="${id}"]`));
    },
  );

  it("opens colors as the score grows, orange from the start", () => {
    expect(isUnlocked("orange", 0)).toBe(true);
    expect(isUnlocked("teal", 99)).toBe(false);
    expect(isUnlocked("teal", 100)).toBe(true);
    expect(nextUnlock(120)).toEqual({ id: "blue", needed: 130 });
    expect(nextUnlock(5000)).toBeNull();
    const thresholds = ACCENTS.map((a) => a.unlockAt);
    expect([...thresholds].sort((a, b) => a - b)).toEqual(thresholds);
  });

  it("validates ids and leaves the default off <html>", () => {
    expect(isAccentId("teal")).toBe(true);
    expect(isAccentId("pink")).toBe(false);
    expect(accentAttribute("orange")).toBeNull();
    expect(accentAttribute("blue")).toBe("blue");
  });
});

/**
 * Prints every theme's lowest contrast in each scheme (D166), and any
 * pair under WCAG AA. tests/theme-contrast.test.ts checks the same pairs.
 *
 *   npm run themes:contrast
 */
import { readFileSync } from "node:fs";
import { ACCENTS, DEFAULT_ACCENT } from "../lib/accents.ts";
import { BACKGROUNDS, type Hex } from "../lib/backgrounds.ts";
import { contrastPairs, type Scheme } from "../lib/theme-contrast.ts";

const css = readFileSync("app/globals.css", "utf8");

/** A token's value in the first CSS block for `selector`. */
export function cssToken(source: string, selector: string, name: string): Hex {
  const start = source.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no block for ${selector}`);
  const body = source.slice(start, source.indexOf("}", start));
  const match = body.match(new RegExp(`--ll-${name}: (#[0-9a-f]{6})`));
  if (!match) throw new Error(`no --ll-${name} in ${selector}`);
  return match[1] as Hex;
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

let failures = 0;
console.log("| theme | scheme | card | lowest text | lowest non-text |");
console.log("| --- | --- | --- | --- | --- |");
for (const b of BACKGROUNDS) {
  for (const scheme of ["light", "dark"] as Scheme[]) {
    const s = SELECTORS[scheme];
    const pairs = contrastPairs(
      b,
      scheme,
      {
        success: cssToken(css, s.base, "success"),
        error: cssToken(css, s.base, "error"),
      },
      ACCENTS.filter(({ id }) => id !== DEFAULT_ACCENT).map(({ id }) => ({
        id,
        accent: cssToken(css, s.accent(id), "accent"),
        accentInk: cssToken(css, s.accent(id), "accent-ink"),
      })),
    );
    const low = (min: number) =>
      Math.min(...pairs.filter((p) => p.min === min).map((p) => p.ratio));
    console.log(
      `| ${b.id} | ${scheme} | ${b.card} | ${low(4.5).toFixed(2)} | ${low(3).toFixed(2)} |`,
    );
    for (const p of pairs.filter((p) => p.ratio < p.min)) {
      failures++;
      console.error(
        `  FAIL ${b.id} ${scheme}: ${p.what} ${p.fg} on ${p.bg} = ${p.ratio.toFixed(2)} (< ${p.min})`,
      );
    }
  }
}
if (failures) {
  console.error(`${failures} pairs under AA`);
  process.exitCode = 1;
}

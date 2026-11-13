import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BACKGROUND_GROUPS,
  BACKGROUNDS,
  CARD_STYLES,
  RECOMMENDED_BACKGROUNDS,
  backgroundAttribute,
  backgroundCss,
  isBackgroundOpen,
  nextBackground,
} from "@/lib/backgrounds";
import { BACKGROUND_IDS } from "@/lib/background-ids";
import en from "@/messages/en.json";
import zh from "@/messages/zh-Hant.json";

const css = readFileSync("app/globals.css", "utf8");

/** A token's value in a CSS block (the first block for `selector`). */
function token(selector: string, name: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  const body = css.slice(start, css.indexOf("}", start));
  return body.match(new RegExp(`--ll-${name}: (#[0-9a-f]{6})`))![1];
}

describe("themes (D121, D166)", () => {
  it("has at least 12, each with a name in both languages", () => {
    expect(BACKGROUNDS.length).toBeGreaterThanOrEqual(13);
    const ids = BACKGROUNDS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const b of BACKGROUNDS) {
      expect(BACKGROUND_GROUPS).toContain(b.group);
      expect(CARD_STYLES).toContain(b.card);
      expect(zh.backgrounds.names).toHaveProperty(b.id);
      expect(en.backgrounds.names).toHaveProperty(b.id);
    }
    expect(ids).toEqual([...BACKGROUND_IDS]);
    // Free, score, and paid ones all exist; so does every card style.
    for (const kind of ["free", "score", "paid"]) {
      expect(BACKGROUNDS.some((b) => b.unlock.kind === kind)).toBe(true);
    }
    for (const style of CARD_STYLES) {
      expect(BACKGROUNDS.some((b) => b.card === style)).toBe(true);
      expect(zh.backgrounds.cards).toHaveProperty(style);
      expect(en.backgrounds.cards).toHaveProperty(style);
    }
  });

  it("keeps every id learners may have saved (no saved choice breaks)", () => {
    // The ids before D166; a saved one must still be a theme. Renaming one
    // needs a mapping in the <head> script and lib/personal-settings.ts.
    const saved = [
      "default",
      "pure",
      "warm-gray",
      "paper",
      "notebook",
      "kraft",
      "forest",
      "ocean",
      "mountain",
      "sunset",
      "cafe",
      "city",
      "rain",
      "washi",
      "retro",
      "nordic",
      "stars",
      "pastel",
      "high-contrast",
    ];
    for (const id of saved) expect(BACKGROUND_IDS).toContain(id);
  });

  it("recommends six, the rest grouped by style", () => {
    expect(RECOMMENDED_BACKGROUNDS).toHaveLength(6);
    expect(new Set(RECOMMENDED_BACKGROUNDS).size).toBe(6);
    expect(RECOMMENDED_BACKGROUNDS[0]).toBe("default");
    for (const id of RECOMMENDED_BACKGROUNDS) {
      expect(BACKGROUND_IDS).toContain(id);
    }
    // Recommended ones show several card styles, and at least half are free.
    const recommended = BACKGROUNDS.filter((b) =>
      RECOMMENDED_BACKGROUNDS.includes(b.id),
    );
    expect(new Set(recommended.map((b) => b.card)).size).toBe(3);
    expect(
      recommended.filter((b) => b.unlock.kind === "free").length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("the default theme is the site's default tokens", () => {
    const b = BACKGROUNDS.find((x) => x.id === "default")!;
    const modes = {
      light: '[data-theme="light"]',
      dark: '[data-theme="dark"]',
    } as const;
    for (const [scheme, selector] of Object.entries(modes)) {
      const mode = b[scheme as "light" | "dark"];
      expect(mode.ground).toBe(token(selector, "ground"));
      expect(mode.surface).toBe(token(selector, "surface"));
      expect(mode.band).toBe(token(selector, "band"));
      expect(mode.line).toBe(token(selector, "line"));
      expect(mode.ink).toBe(token(selector, "ink"));
      expect(mode.inkMuted).toBe(token(selector, "ink-muted"));
      expect(mode.accent).toBe(token(selector, "accent"));
      expect(mode.accentInk).toBe(token(selector, "accent-ink"));
    }
    expect(b.card).toBe("solid");
  });

  it("app/backgrounds.css is written from lib/backgrounds.ts", () => {
    expect(readFileSync("app/backgrounds.css", "utf8")).toBe(backgroundCss());
  });

  it("a chosen accent color wins over the theme's own", () => {
    const generated = backgroundCss();
    // Every theme's accent is set only where no data-accent is.
    const accentBlocks = generated.match(/[^}]*\{\s*--ll-accent: [^}]*\}/g)!;
    expect(accentBlocks.length).toBe(BACKGROUNDS.length * 4);
    for (const blockText of accentBlocks) {
      const selectors = blockText.slice(0, blockText.indexOf("{"));
      for (const selector of selectors.split(",")) {
        expect(selector.trim()).toMatch(/:not\(\[data-accent\]\)$/);
      }
    }
  });

  it("animated themes stand still for reduced motion", () => {
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

  it("theme switches fade, except for reduced motion", () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: no-preference\) \{\s*html\[data-theme-switching\]/,
    );
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

  it("uses no image files and stays small: only gradients and inline SVG", () => {
    const generated = backgroundCss();
    const outside = generated.replace(
      /url\("data:image\/svg\+xml,[^"]*"\)/g,
      "",
    );
    expect(outside).not.toMatch(/url\(/);
    // Every drawn texture is tiny (each SVG under 2 KB).
    for (const svg of generated.match(/url\("data:image[^"]*"\)/g) ?? []) {
      expect(svg.length).toBeLessThan(2048);
    }
  });
});

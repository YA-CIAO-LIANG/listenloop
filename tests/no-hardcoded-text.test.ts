import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Interface text comes from the message files (CLAUDE.md): no Chinese in
 * components or pages outside comments (D61). The one exception is the
 * last-resort error page, which can't rely on translations.
 */
const ALLOWED = new Set([join("app", "global-error.tsx")]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? files(path)
      : path.endsWith(".tsx")
        ? [path]
        : [];
  });
}

describe("no hard-coded Chinese interface text", () => {
  it("in app/ and components/", () => {
    const found: string[] = [];
    for (const file of [...files("app"), ...files("components")]) {
      if (ALLOWED.has(file)) continue;
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          const code = line.trim();
          if (/^(\/\/|\*|\/\*|\{\/\*)/.test(code)) return;
          if (/[一-鿿]/.test(code)) found.push(`${file}:${i + 1}`);
        });
    }
    expect(found).toEqual([]);
  });
});

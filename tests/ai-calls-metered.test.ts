import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The cost circuit breaker (D77, D156) only works if every paid AI call
 * goes through the meter: each call to a provider's paid method in the
 * app must sit inside meteredLanguage, cachedLanguageCall (metered on a miss),
 * meteredTranscribe, or the metered speech helper.
 */
const ROOTS = ["app", "auth", "lib"];
const CALL =
  /\.(language|speech|transcribe)\??\.(compose|revise|describe|segment|translate|annotate|synthesize|transcribe)\(/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("every paid AI call is metered (D156)", () => {
  it("has the meter within a few lines of each call", () => {
    const unmetered: string[] = [];
    for (const file of ROOTS.flatMap(files)) {
      // The providers themselves, and the fake one.
      if (file.startsWith(join("lib", "ai")) && !file.endsWith("metered.ts")) {
        continue;
      }
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (!CALL.test(line)) return;
        const before = lines.slice(Math.max(0, i - 12), i + 1).join("\n");
        if (!/metered\w*\(|cachedLanguageCall/i.test(before)) {
          unmetered.push(`${file}:${i + 1}`);
        }
      });
    }
    expect(unmetered).toEqual([]);
  });
});

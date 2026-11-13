import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Every migration can be undone (D157): the ones before 2026-11-22 are
 * listed in docs/migrations-rollback.md; every newer one says how in a
 * `-- Rollback:` block at its end.
 */
const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql"));
const doc = readFileSync("docs/migrations-rollback.md", "utf8");

describe("migration rollbacks (D157)", () => {
  it("has a rollback block in every migration from 2026-11-22 on", () => {
    const missing = files.filter(
      (f) =>
        f >= "20261122" &&
        !/^-- Rollback:/m.test(readFileSync(`${DIR}/${f}`, "utf8")),
    );
    expect(missing).toEqual([]);
  });

  it("lists every older migration in docs/migrations-rollback.md", () => {
    const missing = files.filter(
      (f) => f < "20261122" && !doc.includes(`\`${f}\``),
    );
    expect(missing).toEqual([]);
  });
});

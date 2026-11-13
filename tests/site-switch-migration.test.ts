import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Public sharing paused (D155) must hold however a practice is written:
 * a trigger in the database, not only the server action.
 */
const sql = readFileSync(
  "supabase/migrations/20261122000000_site_switches.sql",
  "utf8",
);

describe("site switches migration (D155)", () => {
  it("lets anyone read the switches and announcements, only the server write", () => {
    expect(sql).toMatch(
      /revoke all on public\.site_settings from anon, authenticated/,
    );
    expect(sql).toMatch(/grant all on public\.site_settings to service_role/);
    expect(sql).not.toMatch(/grant (insert|update|delete)[^;]*to anon/);
  });

  it("refuses public sharing in the database while it's paused", () => {
    for (const table of ["practices", "collections"]) {
      expect(sql).toContain(
        `before insert or update of visibility on public.${table}`,
      );
    }
    expect(sql).toContain("settings.features ->> 'publicShare' = 'false'");
    expect(sql).toContain("settings.read_only");
  });

  it("says how to roll it back", () => {
    expect(sql).toMatch(/-- Rollback:/);
  });
});

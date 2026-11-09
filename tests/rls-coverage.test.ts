import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Row level security on every table (D63): each `create table` in the
 * migrations has `enable row level security`, and tables only the server
 * writes grant nothing to anon. Checked statically here; the live check
 * against the database is `npm run rls:check`.
 */
const dir = join("supabase", "migrations");
const sql = readdirSync(dir)
  .sort()
  .map((name) => readFileSync(join(dir, name), "utf8"))
  .join("\n");
const dropped = new Set(
  [...sql.matchAll(/drop table if exists public\.(\w+)/g)].map((m) => m[1]),
);
const tables = [...sql.matchAll(/create table public\.(\w+)/g)]
  .map((m) => m[1])
  .filter((name) => !dropped.has(name));

/** Server-written logs and caches: no anon access at all. */
const SERVER_ONLY = [
  "api_calls",
  "api_daily_cost",
  "events",
  "shadowing_issues",
  "admin_audit",
  "feedback",
  "rate_limits",
  "error_logs",
  "usage_settings",
  "api_batch_cost",
  "payment_events",
  "intent_events",
  "shared_practice_grants",
];

describe("row level security", () => {
  it.each(tables)("%s has it enabled", (table) => {
    expect(sql).toMatch(
      new RegExp(`alter table public\\.${table} enable row level security`),
    );
  });

  it.each(SERVER_ONLY)("%s grants nothing to anon", (table) => {
    expect(sql).not.toMatch(
      new RegExp(`grant [^;]*on public\\.${table}[^;]* to [^;]*\\banon\\b`),
    );
  });

  // Shared materials are for paying plans (D106): sentences, earlier
  // versions, and the practice-wide notes go through can_practice.
  it("shared practices' sentences, versions, and notes check can_practice", () => {
    const last = (pattern: RegExp) => [...sql.matchAll(pattern)].pop()?.[0];
    expect(
      last(
        /create policy "[^"]+" on public\.practice_sentences\s+for select[^;]*;/g,
      ),
    ).toMatch(/can_practice\(practice_id\)/);
    expect(
      last(
        /create policy "[^"]+" on public\.practice_versions\s+for select[^;]*;/g,
      ),
    ).toMatch(/can_practice\(practice_id\)/);
    expect(sql).toMatch(
      /revoke select \(vocab, grammar\) on public\.practices from anon/,
    );
    expect(sql).toMatch(
      /revoke select on public\.practices from authenticated/,
    );
    const grant = last(
      /grant select \([^)]*\) on public\.practices to authenticated/g,
    );
    expect(grant).toBeDefined();
    expect(grant).not.toMatch(/\bvocab\b|\bgrammar\b/);
  });

  it("signed-in users may read every practices column but the notes (D106)", () => {
    const types = readFileSync("lib/supabase/database.types.ts", "utf8");
    const start = types.indexOf("      practices: {");
    const row = types.slice(
      types.indexOf("Row: {", start),
      types.indexOf("}", types.indexOf("Row: {", start)),
    );
    const columns = [...row.matchAll(/(\w+)\??:/g)]
      .map((m) => m[1])
      .filter((c) => c !== "Row" && c !== "vocab" && c !== "grammar");
    const grants = [
      ...sql.matchAll(
        /grant select \(([^)]*)\) on public\.practices to authenticated/g,
      ),
    ]
      .flatMap((m) => m[1].split(","))
      .map((c) => c.trim());
    expect(columns.filter((c) => !grants.includes(c))).toEqual([]);
  });
});

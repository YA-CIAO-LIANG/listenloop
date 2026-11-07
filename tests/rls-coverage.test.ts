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
});

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Deleting an account removes everything tied to it (D159): every column
 * that points at an account (auth.users) says what happens when the
 * account goes, either deleted with it (cascade) or kept without the link
 * (set null: the API call log, audit records, invites). Files are removed
 * by deleteAccount itself (auth/actions.ts).
 */
const sql = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(`supabase/migrations/${f}`, "utf8"))
  .join("\n")
  .replace(/\s+/g, " ");

describe("account deletion reaches every table (D159)", () => {
  it("has an on-delete rule for every reference to an account", () => {
    const references =
      sql.match(/references auth\.users ?\(id\)[^,;)]*/g) ?? [];
    expect(references.length).toBeGreaterThan(20);
    const without = references.filter(
      (r) => !/on delete (cascade|set null)/.test(r),
    );
    expect(without).toEqual([]);
  });

  it("removes the account's files too", () => {
    const actions = readFileSync("auth/actions.ts", "utf8");
    expect(actions).toMatch(/removeAudio/);
    expect(actions).toMatch(/removeUploads/);
  });
});

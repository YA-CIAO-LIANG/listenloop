import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RECORDING_URL_SECONDS } from "@/auth/practice-material";

/**
 * Storage access (D159): learners' recordings are private, generated
 * audio is public to read, and nobody but the server (secret key) writes
 * either: no migration may open storage.objects to the public roles.
 */
const sql = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(`supabase/migrations/${f}`, "utf8"))
  .join("\n");

describe("storage buckets and policies (D159)", () => {
  it("keeps recordings private and generated audio public", () => {
    expect(sql).toMatch(
      /insert into storage\.buckets[^;]*values \('uploads', 'uploads', false/,
    );
    expect(sql).toMatch(
      /insert into storage\.buckets[^;]*values \('speech', 'speech', true/,
    );
  });

  it("has no storage policy letting browsers read or write files", () => {
    expect(sql).not.toMatch(/create policy[^;]*on storage\.objects/i);
    expect(sql).not.toMatch(
      /grant [^;]*on storage\.objects[^;]*to (anon|authenticated)/i,
    );
  });

  it("signs recording links for 2 hours at most", () => {
    expect(RECORDING_URL_SECONDS).toBeLessThanOrEqual(2 * 3600);
  });
});

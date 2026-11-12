import { beforeEach, describe, expect, it, vi } from "vitest";

/** Recording how long getting a practice ready took (D142). */
const db = vi.hoisted(() => ({
  updates: [] as { values: unknown; filters: string[] }[],
}));
vi.mock("@/auth/creator", () => ({
  getCreator: async () => ({ user: { id: "u1" } }),
}));
vi.mock("@/auth/admin", () => ({
  getAdminSupabase: () => ({
    from: () => ({
      update: (values: unknown) => {
        const entry = { values, filters: [] as string[] };
        db.updates.push(entry);
        const chain = {
          eq: (column: string, value: string) => {
            entry.filters.push(`${column}=${value}`);
            return chain;
          },
          is: (column: string) => {
            entry.filters.push(`${column} is null`);
            return Promise.resolve({ error: null });
          },
        };
        return chain;
      },
    }),
  }),
}));

const { recordGenerationTime } =
  await import("@/app/materials/generation-time-actions");
const id = "123e4567-e89b-12d3-a456-426614174000";

beforeEach(() => {
  db.updates = [];
});

describe("recordGenerationTime (D142)", () => {
  it("saves the author's own time once, to a tenth of a second", async () => {
    await recordGenerationTime(id, 12.345);
    expect(db.updates).toEqual([
      {
        values: { generation_seconds: 12.3 },
        filters: [`id=${id}`, "user_id=u1", "generation_seconds is null"],
      },
    ]);
  });

  it("ignores anything odd", async () => {
    for (const [practice, seconds] of [
      ["x", 10],
      [id, 0],
      [id, 4000],
      [id, "10"],
      [42, 10],
    ]) {
      await recordGenerationTime(practice, seconds);
    }
    expect(db.updates).toEqual([]);
  });
});

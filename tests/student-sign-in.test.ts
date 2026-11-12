import { beforeEach, describe, expect, it, vi } from "vitest";

/** Verifying a student on sign-in (D144). */
const db = vi.hoisted(() => ({ updates: [] as unknown[] }));
vi.mock("@/auth/admin", () => ({
  getAdminSupabase: () => ({
    from: () => ({
      update: (values: unknown) => ({
        eq: async (column: string, id: string) => {
          db.updates.push({ values, column, id });
          return { error: null };
        },
      }),
    }),
  }),
}));
const { verifyStudentOnSignIn } = await import("@/auth/student");

beforeEach(() => {
  db.updates = [];
});

describe("verifyStudentOnSignIn", () => {
  it("marks a school account verified from now", async () => {
    expect(
      await verifyStudentOnSignIn({ id: "u1", email: "amy@ntu.edu.tw" }),
    ).toBe(true);
    expect(db.updates).toEqual([
      {
        values: { student_verified_at: expect.any(String) },
        column: "user_id",
        id: "u1",
      },
    ]);
  });

  it("leaves other accounts alone", async () => {
    expect(
      await verifyStudentOnSignIn({ id: "u1", email: "joe@gmail.com" }),
    ).toBe(false);
    expect(db.updates).toEqual([]);
  });
});

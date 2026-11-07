import { describe, expect, it, vi } from "vitest";
import { audioOnlyFor } from "@/auth/account-data";
import type { Supabase } from "@/lib/supabase/browser";

/** Deleting an account removes audio only its practices use (D60). */
describe("audioOnlyFor", () => {
  it("keeps files another practice shares", async () => {
    const shared = vi.fn(async () => ({ data: [{ audio_path: "b.mp3" }] }));
    const admin = {
      from: (table: string) =>
        table === "practices"
          ? {
              select: () => ({
                eq: async () => ({
                  data: [
                    {
                      id: "p1",
                      practice_sentences: [
                        { audio_path: "a.mp3" },
                        { audio_path: "b.mp3" },
                      ],
                      practice_versions: [
                        { sentences: [{ audio_path: "old.mp3" }] },
                      ],
                    },
                  ],
                }),
              }),
            }
          : {
              select: () => ({
                in: () => ({ not: shared }),
              }),
            },
    } as unknown as Supabase;
    expect((await audioOnlyFor(admin, "u1")).sort()).toEqual([
      "a.mp3",
      "old.mp3",
    ]);
    expect(shared).toHaveBeenCalledWith("practice_id", "in", "(p1)");
  });
});

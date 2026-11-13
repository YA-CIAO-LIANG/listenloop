import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateAllAudio } from "@/components/practice-generation";
import { QUEUE, queueTicket } from "@/lib/queue";

/** The line for the free speech tier (D133). */
const state = vi.hoisted(() => ({
  position: 0 as number | null,
  rpc: vi.fn(),
}));
vi.mock("@/auth/admin", () => ({
  getAdminSupabase: () => ({ rpc: state.rpc }),
}));

const { leaveQueue, takeTurn } = await import("@/auth/queue");

beforeEach(() => {
  state.position = 0;
  state.rpc
    .mockReset()
    .mockImplementation(async (name: string) =>
      name === "queue_position"
        ? state.position === null
          ? { data: null, error: { message: "down" } }
          : { data: state.position, error: null }
        : { data: null, error: null },
    );
});

describe("takeTurn (D133)", () => {
  it("works when first in line, and says how many are ahead otherwise", async () => {
    expect(await takeTurn("speech", "p1", { id: "u1" }, "paid")).toEqual({
      turn: true,
    });
    state.position = 3;
    expect(await takeTurn("speech", "p1", { id: "u1" }, "paid")).toEqual({
      turn: false,
      ahead: 3,
    });
    expect(state.rpc).toHaveBeenCalledWith("queue_position", {
      target_resource: "speech",
      target_ticket: "speech:p1",
      target_user: "u1",
      // Plus gets a head start of one level (D162).
      target_priority: 1,
      stale_seconds: QUEUE.staleSeconds,
    });
  });

  it("gives Pro and admins the longest head start (D102, D162)", async () => {
    await takeTurn("transcribe", "x", { id: "u1" }, "pro");
    expect(state.rpc).toHaveBeenCalledWith(
      "queue_position",
      expect.objectContaining({ target_priority: 2 }),
    );
  });

  it("lets the job run when the line can't be reached", async () => {
    state.position = null;
    expect(await takeTurn("speech", "p1", { id: "u1" }, "free")).toEqual({
      turn: true,
    });
  });

  it("leaves the line", async () => {
    await leaveQueue("speech", "p1");
    expect(state.rpc).toHaveBeenCalledWith("queue_leave", {
      target_ticket: queueTicket("speech", "p1"),
    });
  });
});

describe("generateAllAudio in line (D133)", () => {
  it("waits its turn, showing the place, then makes the audio", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        reason: "queued",
        ahead: 2,
        voiced: 0,
        total: 4,
      })
      .mockResolvedValueOnce({
        ok: false,
        reason: "queued",
        ahead: 1,
        voiced: 0,
        total: 4,
      })
      .mockResolvedValueOnce({ ok: true, voiced: 4, total: 4 });
    const onQueue = vi.fn();
    const wait = vi.fn(async () => {});
    const result = await generateAllAudio(generate, "p1", () => {}, {
      onQueue,
      wait,
    });
    expect(result).toEqual({ ok: true, voiced: 4, total: 4 });
    expect(onQueue.mock.calls).toEqual([[2], [1]]);
    expect(wait).toHaveBeenCalledWith(QUEUE.pollSeconds);
  });

  it("stops waiting after the limit", async () => {
    const queued = {
      ok: false as const,
      reason: "queued" as const,
      ahead: 5,
      voiced: 0,
      total: 4,
    };
    const generate = vi.fn().mockResolvedValue(queued);
    const result = await generateAllAudio(generate, "p1", () => {}, {
      wait: async () => {},
    });
    expect(result).toEqual(queued);
    expect(generate).toHaveBeenCalledTimes(
      QUEUE.maxWaitSeconds / QUEUE.pollSeconds + 1,
    );
  });
});

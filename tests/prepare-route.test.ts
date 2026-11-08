import { beforeEach, describe, expect, it, vi } from "vitest";

const after = vi.hoisted(() => vi.fn());
vi.mock("next/server", () => ({ after }));
const user = vi.hoisted(() => ({
  value: { id: "u1" } as { id: string } | null,
}));
vi.mock("@/auth/session", () => ({ getSignedInUser: async () => user.value }));
const generatePracticeNotes = vi.hoisted(() =>
  vi.fn(async () => ({ ok: true, annotated: 2, total: 2 })),
);
const generatePracticeAudio = vi.hoisted(() =>
  vi.fn(async () => ({ ok: true, voiced: 2, total: 2 })),
);
vi.mock("@/app/materials/actions", () => ({
  generatePracticeNotes,
  generatePracticeAudio,
}));

const { POST } = await import("@/app/materials/[id]/prepare/route");

const id = "4d8e0a52-6c1b-4f3e-9a7d-2b5c8e1f0a93";
const call = (headers: Record<string, string> = {}) =>
  POST(
    new Request(`http://localhost/materials/${id}/prepare`, {
      method: "POST",
      headers,
    }),
    { params: Promise.resolve({ id }) },
  );

beforeEach(() => {
  after.mockReset();
  user.value = { id: "u1" };
});

describe("finishing a practice after its page closed (D95)", () => {
  it("accepts the beacon and makes the notes and audio afterwards", async () => {
    const response = await call({ origin: "http://localhost" });
    expect(response.status).toBe(202);
    expect(after).toHaveBeenCalledTimes(1);
    await after.mock.calls[0][0]();
    expect(generatePracticeNotes).toHaveBeenCalledWith(id);
    expect(generatePracticeAudio).toHaveBeenCalledWith(id);
  });

  it("refuses other sites and signed-out visitors", async () => {
    expect((await call({ origin: "https://evil.example" })).status).toBe(403);
    user.value = null;
    expect((await call()).status).toBe(404);
    expect(after).not.toHaveBeenCalled();
  });
});

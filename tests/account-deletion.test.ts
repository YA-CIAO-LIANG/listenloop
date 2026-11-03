import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_KEY } from "@/lib/sync/sync";
import { clearPracticeData } from "@/lib/storage/clear-local";
import { PROGRESS_KEY_PREFIX } from "@/lib/storage/local-progress-store";
import { ACTIVITY_KEY, WALLET_KEY } from "@/lib/storage/local-reward-store";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { MemoryStorage } from "./memory-storage";

const auth = vi.hoisted(() => ({
  user: null as { id: string; email: string } | null,
  admin: true,
  deleteUser: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/auth/session", () => ({ getSignedInUser: async () => auth.user }));
vi.mock("@/auth/admin", () => ({
  getAdminSupabase: () =>
    auth.admin ? { auth: { admin: { deleteUser: auth.deleteUser } } } : null,
}));
vi.mock("@/auth/server", () => ({
  getServerSupabase: async () => ({ auth: { signOut: auth.signOut } }),
}));

const { deleteAccount } = await import("@/auth/actions");

beforeEach(() => {
  auth.user = { id: "user-1", email: "joe@example.com" };
  auth.admin = true;
  auth.deleteUser.mockReset().mockResolvedValue({ error: null });
  auth.signOut.mockReset().mockResolvedValue({ error: null });
});

describe("deleteAccount", () => {
  it("deletes the signed-in user (rows go with it) and signs out", async () => {
    expect(await deleteAccount()).toEqual({ ok: true });
    expect(auth.deleteUser).toHaveBeenCalledWith("user-1");
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("deletes no one when signed out", async () => {
    auth.user = null;
    expect(await deleteAccount()).toEqual({ ok: false, reason: "signed-out" });
    expect(auth.deleteUser).not.toHaveBeenCalled();
  });

  it("reports a failure and keeps the session when deleting fails", async () => {
    auth.deleteUser.mockResolvedValue({ error: { message: "down" } });
    expect(await deleteAccount()).toEqual({ ok: false, reason: "failed" });
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it("fails without the secret key", async () => {
    auth.admin = false;
    expect(await deleteAccount()).toEqual({ ok: false, reason: "failed" });
  });

  it("still succeeds if clearing the session cookies fails", async () => {
    auth.signOut.mockRejectedValue(new Error("user gone"));
    expect(await deleteAccount()).toEqual({ ok: true });
  });
});

describe("clearPracticeData", () => {
  it("removes progress, activity, wallet, and account; keeps preferences", () => {
    const storage = new MemoryStorage();
    for (const key of [
      `${PROGRESS_KEY_PREFIX}sintel`,
      `${PROGRESS_KEY_PREFIX}tears-of-steel-1`,
      ACTIVITY_KEY,
      WALLET_KEY,
      ACCOUNT_KEY,
      THEME_STORAGE_KEY,
      "unrelated",
    ]) {
      storage.setItem(key, "{}");
    }
    clearPracticeData(storage);
    expect(
      Array.from({ length: storage.length }, (_, i) => storage.key(i)).sort(),
    ).toEqual([THEME_STORAGE_KEY, "unrelated"].sort());
  });

  it("ignores blocked storage", () => {
    const blocked = {
      get length(): number {
        throw new Error("blocked");
      },
    } as Storage;
    expect(() => clearPracticeData(blocked)).not.toThrow();
  });
});

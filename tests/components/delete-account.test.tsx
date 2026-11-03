import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteAccount } from "@/components/DeleteAccount";
import { SiteFooter } from "@/components/SiteFooter";
import { PROGRESS_KEY_PREFIX } from "@/lib/storage/local-progress-store";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { renderWithIntl } from "../render";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
// The real Server Action can't run in a test DOM; DeleteAccount takes onDelete.
vi.mock("@/auth/actions", () => ({ deleteAccount: vi.fn() }));

const button = (name: string) =>
  screen.getByRole("button", { name }) as HTMLButtonElement;

beforeEach(() => {
  router.replace.mockReset();
  router.refresh.mockReset();
  window.localStorage.clear();
});

describe("DeleteAccount", () => {
  it("asks to confirm before the delete button works; cancel backs out", () => {
    const onDelete = vi.fn();
    renderWithIntl(<DeleteAccount onDelete={onDelete} />);
    fireEvent.click(button("刪除帳號…"));
    expect(screen.getByText(/雲端上所有影片的練習進度/)).toBeTruthy();
    expect(button("永久刪除帳號").disabled).toBe(true);

    fireEvent.click(button("取消"));
    expect(screen.queryByRole("button", { name: "永久刪除帳號" })).toBeNull();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("deletes, clears this device's practice data, and confirms on the account page", async () => {
    window.localStorage.setItem(`${PROGRESS_KEY_PREFIX}sintel`, "{}");
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    const onDelete = vi.fn().mockResolvedValue({ ok: true });
    renderWithIntl(<DeleteAccount onDelete={onDelete} />);
    fireEvent.click(button("刪除帳號…"));
    fireEvent.click(screen.getByRole("checkbox"));
    await act(async () => fireEvent.click(button("永久刪除帳號")));

    expect(onDelete).toHaveBeenCalledOnce();
    expect(
      window.localStorage.getItem(`${PROGRESS_KEY_PREFIX}sintel`),
    ).toBeNull();
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(router.replace).toHaveBeenCalledWith("/account?deleted=1");
    expect(router.refresh).toHaveBeenCalled();
  });

  it.each([
    [{ ok: false, reason: "failed" }, "刪除沒有成功"],
    [{ ok: false, reason: "signed-out" }, "登入已經過期"],
  ])(
    "keeps everything and explains when the server says %j",
    async (result, message) => {
      window.localStorage.setItem(`${PROGRESS_KEY_PREFIX}sintel`, "{}");
      renderWithIntl(
        <DeleteAccount onDelete={vi.fn().mockResolvedValue(result)} />,
      );
      fireEvent.click(button("刪除帳號…"));
      fireEvent.click(screen.getByRole("checkbox"));
      await act(async () => fireEvent.click(button("永久刪除帳號")));

      expect(screen.getByRole("alert").textContent).toContain(message);
      expect(window.localStorage.getItem(`${PROGRESS_KEY_PREFIX}sintel`)).toBe(
        "{}",
      );
      expect(router.replace).not.toHaveBeenCalled();
      expect(button("永久刪除帳號").disabled).toBe(false);
    },
  );

  it("treats a network error like a failed deletion", async () => {
    renderWithIntl(
      <DeleteAccount
        onDelete={vi.fn().mockRejectedValue(new Error("offline"))}
      />,
    );
    fireEvent.click(button("刪除帳號…"));
    fireEvent.click(screen.getByRole("checkbox"));
    await act(async () => fireEvent.click(button("永久刪除帳號")));
    expect(screen.getByRole("alert").textContent).toContain("刪除沒有成功");
  });
});

describe("SiteFooter", () => {
  it("links the privacy policy and the credits", () => {
    renderWithIntl(<SiteFooter />, "en");
    const nav = screen.getByRole("navigation", { name: "Site information" });
    expect(
      [...nav.querySelectorAll("a")].map((a) => a.getAttribute("href")),
    ).toEqual(["/privacy", "/credits"]);
  });
});

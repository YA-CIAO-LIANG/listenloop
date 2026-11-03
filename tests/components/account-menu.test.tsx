import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountMenu } from "@/components/AccountMenu";
import { SignInNotice } from "@/components/SignInNotice";
import { renderWithIntl } from "../render";

const navigation = vi.hoisted(() => ({
  pathname: "/videos/sintel",
  query: "",
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: navigation.replace,
    refresh: navigation.refresh,
    push: vi.fn(),
  }),
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

const auth = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabase: () => ({ auth }),
}));

beforeEach(() => {
  navigation.pathname = "/videos/sintel";
  navigation.query = "";
  for (const fn of [
    navigation.replace,
    navigation.refresh,
    auth.signInWithOAuth,
    auth.signOut,
  ]) {
    fn.mockReset();
  }
});

describe("AccountMenu signed out", () => {
  it("signs in with Google and comes back to this page", async () => {
    navigation.query = "length=1-2";
    auth.signInWithOAuth.mockResolvedValue({ data: {}, error: null });
    renderWithIntl(<AccountMenu user={null} />);
    fireEvent.click(screen.getByRole("button", { name: "登入" }));

    await waitFor(() => expect(auth.signInWithOAuth).toHaveBeenCalled());
    const { provider, options } = auth.signInWithOAuth.mock.calls[0][0];
    expect(provider).toBe("google");
    const callback = new URL(options.redirectTo);
    expect(callback.pathname).toBe("/auth/callback");
    expect(callback.searchParams.get("next")).toBe("/videos/sintel?length=1-2");
    expect(
      (
        screen.getByRole("button", {
          name: "前往 Google…",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("shows the failure notice when the sign-in can't start", async () => {
    auth.signInWithOAuth.mockResolvedValue({
      data: {},
      error: new Error("offline"),
    });
    renderWithIntl(<AccountMenu user={null} />);
    fireEvent.click(screen.getByRole("button", { name: "登入" }));

    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith(
        "/videos/sintel?signin=failed",
        { scroll: false },
      ),
    );
    expect(
      (screen.getByRole("button", { name: "登入" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
});

describe("AccountMenu signed in", () => {
  const open = () => {
    renderWithIntl(<AccountMenu user={{ email: "joe@example.com" }} />);
    const toggle = screen.getByRole("button", { name: /帳號/ });
    fireEvent.click(toggle);
    return toggle;
  };

  it("opens a panel with the email and closes on Escape", () => {
    const toggle = open();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("joe@example.com")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("joe@example.com")).toBeNull();
    expect(document.activeElement).toBe(toggle);
  });

  it("closes on a click outside", () => {
    const toggle = open();
    fireEvent.pointerDown(document.body);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("signs out and refreshes the page", async () => {
    auth.signOut.mockResolvedValue({ error: null });
    open();
    fireEvent.click(screen.getByRole("button", { name: "登出" }));
    await waitFor(() => expect(navigation.refresh).toHaveBeenCalled());
  });

  it("says so when signing out fails", async () => {
    auth.signOut.mockResolvedValue({ error: new Error("offline") });
    open();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "登出" }));
    });
    expect(screen.getByRole("alert").textContent).toContain("登出失敗");
    expect(navigation.refresh).not.toHaveBeenCalled();
  });
});

describe("SignInNotice", () => {
  it("shows nothing without a sign-in result", () => {
    navigation.query = "length=1-2";
    const { container } = renderWithIntl(<SignInNotice />);
    expect(container.innerHTML).toBe("");
  });

  it("explains a failed sign-in and closes, keeping other parameters", () => {
    navigation.query = "length=1-2&signin=failed";
    renderWithIntl(<SignInNotice />);
    expect(screen.getByRole("alert").textContent).toContain("登入沒有成功");
    fireEvent.click(screen.getByRole("button", { name: "關閉" }));
    expect(navigation.replace).toHaveBeenCalledWith(
      "/videos/sintel?length=1-2",
      { scroll: false },
    );
  });

  it("says a cancelled sign-in is fine, in English too", () => {
    navigation.query = "signin=cancelled";
    renderWithIntl(<SignInNotice />, "en");
    expect(screen.getByRole("status").textContent).toContain(
      "Sign-in cancelled.",
    );
  });
});

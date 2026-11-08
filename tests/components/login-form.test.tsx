import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/LoginForm";
import { renderWithIntl } from "../render";

vi.mock("@/app/login/actions", () => ({
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  requestPasswordReset: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/login",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
}));

function setup(line = false) {
  const actions = {
    signin: vi.fn(async () => ({
      ok: false as const,
      reason: "credentials" as const,
    })),
    signup: vi.fn(async () => ({ ok: true as const, sent: true as const })),
    forgot: vi.fn(async () => ({ ok: true as const, sent: true as const })),
  };
  renderWithIntl(<LoginForm next="/stats" line={line} actions={actions} />);
  return actions;
}

describe("LoginForm (D101)", () => {
  it("offers Google, and LINE only when it's set up", () => {
    setup();
    expect(
      screen.getByRole("button", { name: "用 Google 登入" }),
    ).toBeDefined();
    expect(screen.queryByRole("link", { name: "用 LINE 登入" })).toBeNull();
  });

  it("links LINE with where to come back", () => {
    setup(true);
    expect(
      screen.getByRole("link", { name: "用 LINE 登入" }).getAttribute("href"),
    ).toBe("/auth/line?next=%2Fstats");
  });

  it("signs in with email, saying when it's wrong", async () => {
    const actions = setup();
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "a@b.co" },
    });
    fireEvent.change(screen.getByLabelText("密碼"), {
      target: { value: "whatever-123" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "登入" }));
    });
    expect(actions.signin).toHaveBeenCalled();
    expect(screen.getByText("Email 或密碼不正確。")).toBeDefined();
  });

  it("makes an account with a strength hint, then says to check the email", async () => {
    const actions = setup();
    fireEvent.click(
      screen.getByRole("button", { name: "還沒有帳號？建立一個" }),
    );
    fireEvent.change(screen.getByLabelText("密碼"), {
      target: { value: "1234567890" },
    });
    expect(screen.getByText("太弱")).toBeDefined();
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "a@b.co" },
    });
    fireEvent.change(screen.getByLabelText("密碼"), {
      target: { value: "Tea-and-Toast-7" },
    });
    expect(screen.getByText("很安全")).toBeDefined();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "建立帳號" }));
    });
    expect(actions.signup).toHaveBeenCalled();
    expect(screen.getByText(/已寄出確認信/)).toBeDefined();
  });

  it("sends a reset link without saying whether the email has an account", async () => {
    const actions = setup();
    fireEvent.click(screen.getByRole("button", { name: "忘記密碼？" }));
    expect(screen.queryByLabelText("密碼")).toBeNull();
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "a@b.co" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "寄重設連結" }));
    });
    expect(actions.forgot).toHaveBeenCalled();
    expect(screen.getByText(/如果這個 Email 有帳號/)).toBeDefined();
  });
});

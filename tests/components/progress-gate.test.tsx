import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProgressGate } from "@/components/ProgressGate";
import { StoresProvider } from "@/components/StoresProvider";
import { renderWithIntl } from "../render";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
// No cloud in these tests: the provider keeps to this device.
vi.mock("@/lib/supabase/browser", () => ({ getBrowserSupabase: () => null }));

function renderGate(props: { userId: string | null; accounts: boolean }) {
  renderWithIntl(
    <StoresProvider {...props}>
      <ProgressGate place="home">
        <p>今日任務的內容</p>
      </ProgressGate>
    </StoresProvider>,
  );
}

describe("ProgressGate", () => {
  it("asks a signed-out learner to sign in instead of showing progress", () => {
    renderGate({ userId: null, accounts: true });
    expect(screen.queryByText("今日任務的內容")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "登入後查看你的進度" }),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "登入" })).toBeDefined();
    expect(screen.getByText(/登入後會一起存進帳號/)).toBeDefined();
  });

  it("shows progress to a signed-in learner", () => {
    renderGate({ userId: "user-1", accounts: true });
    expect(screen.getByText("今日任務的內容")).toBeDefined();
    expect(screen.queryByRole("button", { name: "登入" })).toBeNull();
  });

  it("shows progress when this build has no accounts to sign in to", () => {
    renderGate({ userId: null, accounts: false });
    expect(screen.getByText("今日任務的內容")).toBeDefined();
  });

  it("uses the progress page's wording there", () => {
    renderWithIntl(
      <StoresProvider userId={null} accounts>
        <ProgressGate place="practices">
          <p>學習進度</p>
        </ProgressGate>
      </StoresProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "登入後查看學習進度" }),
    ).toBeDefined();
  });
});

import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConnectionTest } from "@/components/ConnectionTest";
import { renderWithIntl } from "../render";

vi.mock("@/app/admin/usage/actions", () => ({ testConnections: vi.fn() }));

async function press(testConnections: () => Promise<never>) {
  renderWithIntl(<ConnectionTest testConnections={testConnections} />);
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "測試連線（免費）" })),
  );
}

describe("ConnectionTest (D49)", () => {
  it("shows each provider's result, with the status and a hint", async () => {
    await press(
      vi.fn().mockResolvedValue({
        ok: true,
        language: { ok: false, status: 404, code: "DeploymentNotFound" },
        speech: { ok: true, status: 200 },
      }),
    );
    expect(
      screen.getByText("失敗（HTTP 404 DeploymentNotFound）"),
    ).toBeTruthy();
    expect(screen.getByText(/找不到這個部署名稱/)).toBeTruthy();
    expect(screen.getByText("連線成功")).toBeTruthy();
  });

  it("falls back to the status's hint for an unknown code", async () => {
    await press(
      vi.fn().mockResolvedValue({
        ok: true,
        language: { ok: false, status: 401, code: "PermissionDenied" },
        speech: null,
      }),
    );
    expect(screen.getByText(/金鑰錯誤/)).toBeTruthy();
    expect(screen.getByText("這個供應者沒有測試方式")).toBeTruthy();
  });

  it("says when the server can't be reached", async () => {
    await press(vi.fn().mockRejectedValue(new Error("offline")));
    expect(screen.getByRole("alert").textContent).toMatch(/連不上伺服器/);
  });
});

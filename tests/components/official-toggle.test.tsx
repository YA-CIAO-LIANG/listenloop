import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OfficialToggle } from "@/components/OfficialToggle";
import { renderWithIntl } from "../render";

vi.mock("@/app/materials/organize-actions", () => ({
  copyAsOfficial: vi.fn(),
}));

describe("OfficialToggle (D80)", () => {
  it("copies the practice and links to the official materials", async () => {
    const copyAsOfficial = vi.fn().mockResolvedValue({ ok: true, id: "c1" });
    renderWithIntl(
      <OfficialToggle
        practice={{ id: "p1", title: "第一課" }}
        copyAsOfficial={copyAsOfficial}
      />,
    );
    const button = screen.getByRole("button", {
      name: "把「第一課」複製為官方教材",
    });
    expect(button.textContent).toBe("複製為官方教材");
    await act(async () => fireEvent.click(button));
    expect(copyAsOfficial).toHaveBeenCalledWith("p1");
    expect(screen.getByText(/已複製到官方教材/)).toBeDefined();
    expect(
      screen.getByRole("link", { name: "前往官方教材 →" }).getAttribute("href"),
    ).toBe("/admin/official");
  });

  it("shows why it failed", async () => {
    renderWithIntl(
      <OfficialToggle
        practice={{ id: "p1", title: "第一課" }}
        copyAsOfficial={vi
          .fn()
          .mockResolvedValue({ ok: false, reason: "failed" })}
      />,
    );
    await act(async () => fireEvent.click(screen.getByRole("button")));
    expect(screen.getByRole("alert")).toBeDefined();
  });
});

import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OfficialToggle } from "@/components/OfficialToggle";
import { renderWithIntl } from "../render";

vi.mock("@/app/materials/organize-actions", () => ({ setOfficial: vi.fn() }));

describe("OfficialToggle", () => {
  it("marks and unmarks, as a pressed button", async () => {
    const setOfficial = vi.fn().mockResolvedValue({ ok: true });
    renderWithIntl(
      <OfficialToggle
        practice={{ id: "p1", title: "第一課", official: false }}
        setOfficial={setOfficial}
      />,
    );
    const button = screen.getByRole("button", {
      name: "「第一課」是否為官方教材",
    });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.textContent).toBe("設為官方教材");
    await act(async () => fireEvent.click(button));
    expect(setOfficial).toHaveBeenCalledWith("p1", true);
  });

  it("shows why it failed", async () => {
    renderWithIntl(
      <OfficialToggle
        practice={{ id: "p1", title: "第一課", official: true }}
        setOfficial={vi.fn().mockResolvedValue({ ok: false, reason: "failed" })}
      />,
    );
    await act(async () => fireEvent.click(screen.getByRole("button")));
    expect(screen.getByRole("alert")).toBeDefined();
  });
});

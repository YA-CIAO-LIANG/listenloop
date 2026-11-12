import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BetaWaitlistForm } from "@/components/BetaWaitlistForm";
import { renderWithIntl } from "../render";

vi.mock("@/app/beta/actions", () => ({ joinBetaWaitlist: vi.fn() }));

describe("BetaWaitlistForm (D132)", () => {
  it("sends the email and the purpose, then says it's done", async () => {
    const join = vi.fn(async () => ({ ok: true as const }));
    renderWithIntl(<BetaWaitlistForm join={join} />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "a@b.co" },
    });
    fireEvent.change(screen.getByLabelText(/你想用 ListenLoop 做什麼/), {
      target: { value: "準備多益" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "加入等候名單" }));
    });
    expect(join).toHaveBeenCalledWith({ email: "a@b.co", purpose: "準備多益" });
    expect(screen.getByRole("status").textContent).toContain("已加入等候名單");
  });

  it("says why it didn't work", async () => {
    const join = vi.fn(async () => ({
      ok: false as const,
      reason: "busy" as const,
    }));
    renderWithIntl(<BetaWaitlistForm join={join} />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "a@b.co" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "加入等候名單" }));
    });
    expect(screen.getByRole("alert").textContent).toContain("太多次");
  });
});

import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModerationControls } from "@/components/ModerationControls";
import { ReportPractice } from "@/components/ReportPractice";
import { renderWithIntl } from "../render";

vi.mock("@/app/reports/actions", () => ({ reportPractice: vi.fn() }));
vi.mock("@/app/admin/reports/actions", () => ({
  removePractice: vi.fn(),
  dismissReports: vi.fn(),
  restorePractice: vi.fn(),
}));

const click = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
};

describe("ReportPractice", () => {
  it("sends a reason and details, then thanks the reporter", async () => {
    const report = vi.fn().mockResolvedValue({ ok: true });
    renderWithIntl(
      <ReportPractice practiceId="p-1" signedIn report={report} />,
    );
    await click("檢舉這份練習");
    const send = screen.getByRole("button", { name: "送出檢舉" });
    expect((send as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/含有個人資料/));
    fireEvent.change(screen.getByLabelText("補充說明（選填）"), {
      target: { value: "第 3 句有電話號碼" },
    });
    await click("送出檢舉");
    expect(report).toHaveBeenCalledWith("p-1", "personal", "第 3 句有電話號碼");
    expect(screen.getByRole("status").textContent).toContain("已收到你的檢舉");
  });

  it("explains a report it couldn't send", async () => {
    const report = vi.fn().mockResolvedValue({ ok: false, reason: "already" });
    renderWithIntl(
      <ReportPractice practiceId="p-1" signedIn report={report} />,
    );
    await click("檢舉這份練習");
    fireEvent.click(screen.getByLabelText(/侵權/));
    await click("送出檢舉");
    expect(screen.getByRole("alert").textContent).toBe(
      "你已經檢舉過這份練習，管理員審查中。",
    );
  });

  it("asks signed-out visitors to sign in", async () => {
    const report = vi.fn();
    renderWithIntl(
      <ReportPractice practiceId="p-1" signedIn={false} report={report} />,
    );
    await click("檢舉這份練習");
    expect(screen.getByText(/登入後才能檢舉/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "送出檢舉" })).toBeNull();
  });
});

describe("ModerationControls", () => {
  it("takes down with the chosen reason, or dismisses", async () => {
    const removePractice = vi.fn().mockResolvedValue({ ok: true });
    const dismissReports = vi.fn().mockResolvedValue({ ok: true });
    renderWithIntl(
      <ModerationControls
        practiceId="uuid-1"
        title="面試"
        defaultReason="spam"
        removePractice={removePractice}
        dismissReports={dismissReports}
      />,
    );
    expect((screen.getByLabelText("下架原因") as HTMLSelectElement).value).toBe(
      "spam",
    );
    fireEvent.change(screen.getByLabelText("下架原因"), {
      target: { value: "copyright" },
    });
    await click("下架「面試」");
    expect(removePractice).toHaveBeenCalledWith("uuid-1", "copyright");
    await click("駁回「面試」的檢舉");
    expect(dismissReports).toHaveBeenCalledWith("uuid-1");
  });
});

import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteAnnouncementBanner } from "@/components/SiteAnnouncementBanner";
import { SiteSwitchesForm } from "@/components/OpsAdmin";
import { DEFAULT_SWITCHES } from "@/lib/site-switches";
import { renderWithIntl } from "../render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/admin/ops/actions", () => ({
  saveSiteSwitches: vi.fn(),
  postSiteAnnouncement: vi.fn(),
  endSiteAnnouncement: vi.fn(),
}));

describe("SiteSwitchesForm (D155)", () => {
  it("asks before saving, then saves every switch", async () => {
    const save = vi.fn(async () => ({ ok: true as const }));
    renderWithIntl(<SiteSwitchesForm saved={DEFAULT_SWITCHES} save={save} />);
    const readOnly = screen.getByRole("group", { name: "唯讀模式" });
    fireEvent.click(within(readOnly).getByLabelText("開啟"));
    const generate = screen.getByRole("group", { name: "AI 生成文字" });
    fireEvent.click(within(generate).getByLabelText("暫停"));
    fireEvent.click(screen.getByRole("button", { name: "儲存開關" }));
    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "確定變更" }));
    });
    expect(save).toHaveBeenCalledWith({
      ...DEFAULT_SWITCHES,
      readOnly: true,
      features: { ...DEFAULT_SWITCHES.features, aiGenerate: false },
    });
    expect(screen.getByRole("status").textContent).toContain("已儲存");
  });
});

describe("SiteAnnouncementBanner (D155)", () => {
  it("can be dismissed on this device, but a critical one can't", async () => {
    localStorage.clear();
    const { unmount } = renderWithIntl(
      <SiteAnnouncementBanner id="a1" level="info" body="今晚維護" />,
    );
    expect(await screen.findByText("今晚維護")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "關閉公告" }));
    expect(screen.queryByText("今晚維護")).toBeNull();
    unmount();
    renderWithIntl(
      <SiteAnnouncementBanner id="a1" level="info" body="今晚維護" />,
    );
    await act(async () => {});
    expect(screen.queryByText("今晚維護")).toBeNull();
    renderWithIntl(
      <SiteAnnouncementBanner id="a2" level="critical" body="重要" />,
    );
    expect(await screen.findByText("重要")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "關閉公告" })).toBeNull();
  });
});

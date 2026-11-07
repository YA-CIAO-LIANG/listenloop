import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { USAGE_NOTICE_KEY, UsageNotice } from "@/components/UsageNotice";
import { renderWithIntl } from "../render";

/** The once-per-device notice about the terms and young users (D60). */
describe("UsageNotice", () => {
  beforeEach(() => window.localStorage.clear());

  it("shows until dismissed, then stays hidden", async () => {
    renderWithIntl(<UsageNotice />);
    await act(async () => {});
    const notice = screen.getByRole("region", { name: "使用說明" });
    expect(notice.textContent).toContain("未滿 18 歲");
    expect(
      screen.getByRole("link", { name: "服務條款" }).getAttribute("href"),
    ).toBe("/terms");
    fireEvent.click(screen.getByRole("button", { name: "知道了" }));
    expect(screen.queryByRole("region", { name: "使用說明" })).toBeNull();
    expect(window.localStorage.getItem(USAGE_NOTICE_KEY)).not.toBeNull();
  });

  it("stays hidden once read on this device", async () => {
    window.localStorage.setItem(USAGE_NOTICE_KEY, "2026-11-07");
    renderWithIntl(<UsageNotice />);
    await act(async () => {});
    expect(screen.queryByRole("region")).toBeNull();
  });
});

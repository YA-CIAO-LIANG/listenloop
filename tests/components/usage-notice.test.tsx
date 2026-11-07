import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { UsageNotice } from "@/components/UsageNotice";
import { Onboarding } from "@/components/Onboarding";
import { ONBOARDING_COOKIE, USAGE_NOTICE_COOKIE } from "@/lib/notices";
import { renderWithIntl } from "../render";

/** One-time notices, remembered in cookies (D60, D61, D62). */
describe("one-time notices", () => {
  beforeEach(() => {
    for (const name of [USAGE_NOTICE_COOKIE, ONBOARDING_COOKIE]) {
      document.cookie = `${name}=; max-age=0; path=/`;
    }
  });

  it("the usage notice hides on 'Got it' and remembers it", () => {
    renderWithIntl(<UsageNotice />);
    const notice = screen.getByRole("region", { name: "使用說明" });
    expect(notice.textContent).toContain("未滿 18 歲");
    expect(
      screen.getByRole("link", { name: "服務條款" }).getAttribute("href"),
    ).toBe("/terms");
    fireEvent.click(screen.getByRole("button", { name: "知道了" }));
    expect(screen.queryByRole("region", { name: "使用說明" })).toBeNull();
    expect(document.cookie).toContain(`${USAGE_NOTICE_COOKIE}=1`);
  });

  it("the guide links to where to start and remembers 'Skip'", () => {
    renderWithIntl(<Onboarding startHref="/videos/p-1" />);
    expect(
      screen
        .getByRole("link", { name: /從推薦的第一份開始/ })
        .getAttribute("href"),
    ).toBe("/videos/p-1");
    fireEvent.click(screen.getByRole("button", { name: "略過" }));
    expect(screen.queryByRole("region")).toBeNull();
    expect(document.cookie).toContain(`${ONBOARDING_COOKIE}=1`);
  });
});

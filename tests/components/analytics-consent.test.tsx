import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AnalyticsConsent,
  CONSENT_OPEN_EVENT,
} from "@/components/AnalyticsConsent";
import { renderWithIntl } from "../render";

const nav = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

const clarityScripts = () =>
  [...document.querySelectorAll("script")].filter((s) =>
    s.src.includes("clarity.ms"),
  );

beforeEach(() => {
  document.cookie = "ll-consent=; Max-Age=0; Path=/";
  document.head.innerHTML = "";
  document.body.removeAttribute("data-clarity-mask");
  delete (window as { clarity?: unknown }).clarity;
  nav.pathname = "/";
});

describe("AnalyticsConsent (D148)", () => {
  it("shows nothing and loads nothing without a project id", () => {
    renderWithIntl(<AnalyticsConsent projectId={null} />);
    expect(screen.queryByRole("region", { name: "Cookie 設定" })).toBeNull();
    expect(clarityScripts()).toHaveLength(0);
  });

  it("asks first; Clarity loads only after accepting", async () => {
    renderWithIntl(<AnalyticsConsent projectId="abc123xyz" />);
    expect(screen.getByRole("region", { name: "Cookie 設定" })).toBeDefined();
    expect(clarityScripts()).toHaveLength(0);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "接受分析 Cookie" }));
    });
    expect(document.cookie).toContain("ll-consent=granted");
    expect(clarityScripts().map((s) => s.src)).toEqual([
      "https://www.clarity.ms/tag/abc123xyz",
    ]);
    expect(screen.queryByRole("region", { name: "Cookie 設定" })).toBeNull();
  });

  it("declining loads nothing; the footer can ask again", async () => {
    renderWithIntl(<AnalyticsConsent projectId="abc123xyz" />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "只用必要的 Cookie" }),
      );
    });
    expect(document.cookie).toContain("ll-consent=denied");
    expect(clarityScripts()).toHaveLength(0);
    await act(async () => {
      window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
    });
    expect(screen.getByRole("region", { name: "Cookie 設定" })).toBeDefined();
  });

  it("masks account and admin pages whole", () => {
    nav.pathname = "/account";
    renderWithIntl(<AnalyticsConsent projectId="abc123xyz" />);
    expect(document.body.getAttribute("data-clarity-mask")).toBe("True");
  });
});

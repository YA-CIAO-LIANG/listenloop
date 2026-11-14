import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AnalyticsConsent,
  CONSENT_OPEN_EVENT,
  ConsentSetting,
} from "@/components/AnalyticsConsent";
import { renderWithIntl } from "../render";

const nav = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
const saveConsent = vi.hoisted(() => vi.fn(async () => ({ ok: true })));
vi.mock("@/app/consent-actions", () => ({ saveConsent }));

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
  saveConsent.mockClear();
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

describe("remembering the choice (D180)", () => {
  const notice = () => screen.queryByRole("region", { name: "Cookie 設定" });

  it("signed out: the browser keeps it and nothing goes to an account", async () => {
    renderWithIntl(<AnalyticsConsent projectId="abc123xyz" />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "只用必要的 Cookie" }),
      );
    });
    expect(notice()).toBeNull();
    expect(saveConsent).not.toHaveBeenCalled();
  });

  it("signed in: a choice goes to the account too", async () => {
    renderWithIntl(<AnalyticsConsent projectId="abc123xyz" account={null} />);
    expect(notice()).not.toBeNull();
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "只用必要的 Cookie" }),
      );
    });
    expect(saveConsent).toHaveBeenCalledWith("denied");
    expect(notice()).toBeNull();
  });

  it("a new device: the account's choice applies without asking", async () => {
    await act(async () => {
      renderWithIntl(
        <AnalyticsConsent projectId="abc123xyz" account="denied" />,
      );
    });
    expect(notice()).toBeNull();
    expect(document.cookie).toContain("ll-consent=denied");
    expect(saveConsent).not.toHaveBeenCalled();
  });

  it("chosen before signing in: it becomes the account's, once", async () => {
    document.cookie = "ll-consent=denied; Path=/";
    await act(async () => {
      renderWithIntl(<AnalyticsConsent projectId="abc123xyz" account={null} />);
    });
    expect(notice()).toBeNull();
    expect(saveConsent).toHaveBeenCalledTimes(1);
    expect(saveConsent).toHaveBeenCalledWith("denied");
  });

  it("the account page shows the choice and can ask again", async () => {
    document.cookie = "ll-consent=granted; Path=/";
    const opened = vi.fn();
    window.addEventListener(CONSENT_OPEN_EVENT, opened);
    renderWithIntl(<ConsentSetting />);
    expect(screen.getByRole("status").textContent).toBe(
      "目前：已接受分析 Cookie",
    );
    fireEvent.click(screen.getByRole("button", { name: "更改 Cookie 設定" }));
    expect(opened).toHaveBeenCalledTimes(1);
    window.removeEventListener(CONSENT_OPEN_EVENT, opened);
  });
});

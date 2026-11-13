import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteHeader } from "@/components/SiteHeader";
import { renderWithIntl } from "../render";

vi.mock("@/i18n/actions", () => ({ setLocale: vi.fn() }));
// The language switch leaves a ?hl= address with the router (D167).
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  useRouter: () => ({ replace: vi.fn() }),
}));

const navLinks = () =>
  screen.getByRole("navigation", { name: "主要導覽" }).querySelectorAll("a");

describe("SiteHeader", () => {
  it("shows Progress and Shared materials to everyone", () => {
    renderWithIntl(<SiteHeader />);
    expect([...navLinks()].map((a) => a.textContent)).toEqual([
      "ListenLoop",
      "學習進度",
      "公開教材",
    ]);
  });

  it("adds Stats and My materials when signed in", () => {
    renderWithIntl(<SiteHeader showMaterials />);
    expect(
      [...navLinks()].map((a) => [a.textContent, a.getAttribute("href")]),
    ).toEqual([
      ["ListenLoop", "/"],
      ["學習進度", "/practices"],
      ["學習分析", "/stats"],
      ["公開教材", "/explore"],
      ["班級", "/classroom"],
      ["我的教材", "/materials"],
    ]);
    expect(screen.queryByRole("link", { name: /建立練習/ })).toBeNull();
  });

  it("shows Create a practice to admins who can create", () => {
    renderWithIntl(<SiteHeader showMaterials showCreate />);
    expect(
      screen.getByRole("link", { name: /建立練習/ }).getAttribute("href"),
    ).toBe("/materials/new");
  });
});

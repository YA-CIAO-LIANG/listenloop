import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteHeader } from "@/components/SiteHeader";
import { renderWithIntl } from "../render";

vi.mock("@/i18n/actions", () => ({ setLocale: vi.fn() }));

const navLinks = () =>
  screen.getByRole("navigation", { name: "主要導覽" }).querySelectorAll("a");

describe("SiteHeader", () => {
  it("shows Progress to everyone", () => {
    renderWithIntl(<SiteHeader />);
    expect([...navLinks()].map((a) => a.textContent)).toEqual([
      "ListenLoop",
      "學習進度",
    ]);
  });

  it("adds My materials and Notebooks for admins", () => {
    renderWithIntl(<SiteHeader showMaterials showNotebooks />);
    expect(
      [...navLinks()].map((a) => [a.textContent, a.getAttribute("href")]),
    ).toEqual([
      ["ListenLoop", "/"],
      ["學習進度", "/practices"],
      ["我的教材", "/materials"],
      ["筆記本", "/notebooks"],
    ]);
  });
});

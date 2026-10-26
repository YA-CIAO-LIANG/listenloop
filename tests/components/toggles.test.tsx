import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { renderWithIntl } from "../render";

const setLocale = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/i18n/actions", () => ({ setLocale }));

describe("ThemeToggle", () => {
  it("is a labelled radio group defaulting to system", () => {
    renderWithIntl(<ThemeToggle />);
    expect(screen.getByRole("group", { name: "外觀" })).toBeDefined();
    expect(screen.getByRole("radio", { name: "跟隨系統" })).toHaveProperty(
      "checked",
      true,
    );
  });

  it("saves and applies an explicit theme", async () => {
    renderWithIntl(<ThemeToggle />);
    await userEvent.click(screen.getByRole("radio", { name: "深色" }));

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("radio", { name: "深色" })).toHaveProperty(
      "checked",
      true,
    );
  });

  it("clears the saved theme when going back to system", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    renderWithIntl(<ThemeToggle />);
    expect(screen.getByRole("radio", { name: "淺色" })).toHaveProperty(
      "checked",
      true,
    );

    await userEvent.click(screen.getByRole("radio", { name: "跟隨系統" }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("supports arrow keys like a native radio group", async () => {
    renderWithIntl(<ThemeToggle />);
    screen.getByRole("radio", { name: "跟隨系統" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("keeps two instances (header + page) as separate radio groups", async () => {
    renderWithIntl(
      <>
        <ThemeToggle />
        <ThemeToggle />
      </>,
    );
    const [first, second] = screen.getAllByRole("radio", { name: "跟隨系統" });
    expect(first.getAttribute("name")).not.toBe(second.getAttribute("name"));

    // Both still reflect the shared saved preference.
    await userEvent.click(screen.getAllByRole("radio", { name: "深色" })[0]);
    for (const radio of screen.getAllByRole("radio", { name: "深色" })) {
      expect(radio).toHaveProperty("checked", true);
    }
  });

  it("uses English labels in the English UI", () => {
    renderWithIntl(<ThemeToggle />, "en");
    expect(screen.getByRole("group", { name: "Appearance" })).toBeDefined();
    expect(screen.getByRole("radio", { name: "System" })).toBeDefined();
  });
});

describe("LanguageToggle", () => {
  it("marks the current language and tags each label with its language", () => {
    renderWithIntl(<LanguageToggle />);
    expect(screen.getByRole("group", { name: "介面語言" })).toBeDefined();
    expect(screen.getByRole("radio", { name: "中文" })).toHaveProperty(
      "checked",
      true,
    );
    expect(screen.getByText("EN").getAttribute("lang")).toBe("en");
    expect(screen.getByText("中文").getAttribute("lang")).toBe("zh-Hant");
  });

  it("saves the new language through the Server Action", async () => {
    renderWithIntl(<LanguageToggle />);
    await userEvent.click(screen.getByRole("radio", { name: "EN" }));
    await waitFor(() => expect(setLocale).toHaveBeenCalledWith("en"));
  });
});

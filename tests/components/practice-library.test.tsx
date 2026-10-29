import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LibraryView,
  PracticeLibrary,
  type LibraryGroup,
  type VideoSummary,
} from "@/components/PracticeLibrary";
import { renderWithIntl } from "../render";

const navigation = vi.hoisted(() => ({
  query: "",
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace, push: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

const video = (id: string, seconds: number): VideoSummary => ({
  id,
  title: id.toUpperCase(),
  level: "beginner",
  category: "story",
  source: "Test",
  sentenceCount: 10,
  seconds,
});

const groups: LibraryGroup[] = [
  {
    collection: "blender-open-movies",
    videos: [video("a", 100), video("b", 125), video("c", 600)],
  },
];

const pressed = () =>
  screen
    .getAllByRole("button", { pressed: true })
    .map((button) => button.textContent);

beforeEach(() => {
  navigation.query = "";
  navigation.replace.mockClear();
});

describe("library cards", () => {
  it("show the excerpt length, whole minutes without seconds", () => {
    renderWithIntl(
      <LibraryView
        groups={[
          {
            collection: "blender-open-movies",
            videos: [video("a", 100), video("b", 120)],
          },
        ]}
        selected={[]}
        onToggle={() => {}}
        onClear={() => {}}
      />,
    );
    expect(screen.getByText(/片段長度 1 分 40 秒/)).toBeDefined();
    expect(screen.getByText(/片段長度 2 分鐘/)).toBeDefined();
  });
});

describe("PracticeLibrary length filter", () => {
  it("offers every length with its count, none pressed at first", () => {
    renderWithIntl(<PracticeLibrary groups={groups} />);
    const filter = screen.getByRole("group", { name: "片段長度" });
    const buttons = within(filter).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual([
      "1～2 分鐘（1）",
      "2～3 分鐘（1）",
      "3～4 分鐘（0）",
      "4～5 分鐘（0）",
      "5～6 分鐘（0）",
      "6～7 分鐘（0）",
      "7～8 分鐘（0）",
      "8 分鐘以上（1）",
    ]);
    expect(screen.queryAllByRole("button", { pressed: true })).toEqual([]);
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("reads several lengths from the URL and shows videos in any of them", () => {
    navigation.query = "length=8-plus,1-2,bogus";
    renderWithIntl(<PracticeLibrary groups={groups} />);
    expect(pressed()).toEqual(["✓ 1～2 分鐘（1）", "✓ 8 分鐘以上（1）"]);
    expect(screen.getAllByRole("link").map((l) => l.textContent)).toEqual([
      expect.stringContaining("A"),
      expect.stringContaining("C"),
    ]);
    // The collection's count follows the filter; the result is announced.
    expect(screen.getByRole("heading", { level: 3 }).textContent).toContain(
      "2 支影片",
    );
    expect(screen.getByText("顯示 2 支影片").getAttribute("aria-live")).toBe(
      "polite",
    );
  });

  it("writes the choice to the URL without scrolling", () => {
    navigation.query = "length=8-plus";
    renderWithIntl(<PracticeLibrary groups={groups} />);
    fireEvent.click(screen.getByRole("button", { name: "1～2 分鐘（1）" }));
    expect(navigation.replace).toHaveBeenLastCalledWith(
      "/?length=1-2%2C8-plus",
      { scroll: false },
    );
    // The ✓ is decoration (aria-hidden); aria-pressed carries the state.
    const on = screen.getByRole("button", { name: "8 分鐘以上（1）" });
    expect(on.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(on);
    expect(navigation.replace).toHaveBeenLastCalledWith("/", { scroll: false });
  });

  it("hides empty collections; with no match, offers to clear the filter", () => {
    navigation.query = "length=4-5";
    renderWithIntl(<PracticeLibrary groups={groups} />);
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
    expect(screen.getByText("沒有符合的影片。")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "清除篩選" }));
    expect(navigation.replace).toHaveBeenLastCalledWith("/", { scroll: false });
    fireEvent.click(screen.getByRole("button", { name: "清除" }));
    expect(navigation.replace).toHaveBeenCalledTimes(2);
  });
});

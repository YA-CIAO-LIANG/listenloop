import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MaterialLibraryView } from "@/components/MaterialLibrary";
import {
  NO_LIBRARY_FILTER,
  type LibraryFilter,
  type LibraryItem,
} from "@/lib/library";
import { renderWithIntl } from "../render";

const item = (over: Partial<LibraryItem>): LibraryItem => ({
  id: "x",
  kind: "audio",
  title: "Title",
  subtitle: null,
  category: null,
  exam: null,
  examTarget: null,
  level: null,
  seconds: 90,
  accent: null,
  sentenceCount: 10,
  createdAt: "2026-11-01T00:00:00Z",
  sortOrder: null,
  learners: 0,
  ...over,
});

const items = [
  item({
    id: "sintel",
    kind: "video",
    title: "Sintel",
    subtitle: "少女尋找小龍",
    category: "talks-stories",
    level: "intermediate",
    seconds: 49,
  }),
  item({
    id: "p-1",
    title: "Rescheduling the Client Meeting",
    category: "exam",
    exam: "toeic",
    examTarget: "toeic-750",
    level: "intermediate",
    accent: "au",
    seconds: 125,
    sortOrder: 1,
  }),
  item({
    id: "p-2",
    title: "Checking In for a Flight Home",
    category: "travel",
    level: "beginner",
    accent: "gb",
    seconds: 400,
    sortOrder: 2,
  }),
];

function show(filter: Partial<LibraryFilter> = {}) {
  const onChange = vi.fn();
  renderWithIntl(
    <MaterialLibraryView
      items={items}
      filter={{ ...NO_LIBRARY_FILTER, ...filter }}
      onChange={onChange}
    />,
  );
  return onChange;
}

const titles = () =>
  screen
    .getAllByRole("link")
    .map((link) => link.querySelector(".font-display")?.textContent);

describe("MaterialLibraryView", () => {
  it("lists every material, the admins' order first", () => {
    show();
    expect(titles()).toEqual([
      "Rescheduling the Client Meeting",
      "Checking In for a Flight Home",
      "Sintel",
    ]);
    expect(screen.getByText("3 份教材")).toBeTruthy();
  });

  it("shows type, category, level as words, the exam target, and time", () => {
    show();
    const card = screen.getAllByRole("link")[0];
    expect(card.textContent).toContain("音檔");
    expect(card.textContent).toContain("考試聽力");
    expect(card.textContent).toContain("中級");
    expect(card.textContent).toContain("多益 TOEIC 風格 · 目標 750 分");
    expect(card.textContent).toContain("2 分 5 秒 · 澳洲英語 · 每天約 9 分鐘");
    expect(screen.getAllByRole("link")[2].textContent).toContain(
      "少女尋找小龍",
    );
  });

  it("filters by what's in the URL", () => {
    show({ levels: ["beginner"] });
    expect(titles()).toEqual(["Checking In for a Flight Home"]);
  });

  it("turns a filter on", () => {
    const onChange = show();
    const sidebar = screen.getByRole("complementary", { name: "篩選" });
    const levels = within(sidebar).getByRole("group", { name: "程度" });
    fireEvent.click(within(levels).getByRole("button", { name: /初級/ }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ levels: ["beginner"] }),
    );
  });

  it("searches and sorts", () => {
    const onChange = show();
    fireEvent.change(screen.getByLabelText("搜尋"), {
      target: { value: "flight" },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: "flight" }),
    );
    fireEvent.change(screen.getByLabelText("排序"), {
      target: { value: "shortest" },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: "shortest" }),
    );
  });

  it("offers to clear when nothing matches", () => {
    const onChange = show({ query: "zzz" });
    expect(screen.getByText("沒有符合的教材。")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "清除所有篩選" }));
    expect(onChange).toHaveBeenCalledWith(NO_LIBRARY_FILTER);
  });

  it("opens the filters in a drawer on phones, counting the ones on", () => {
    show({ accents: ["gb"], minutes: 30 });
    fireEvent.click(screen.getByRole("button", { name: "篩選（2）" }));
    const drawer = screen.getByRole("dialog", { name: "篩選" });
    expect(
      within(drawer).getByRole("button", { name: "顯示 1 份教材" }),
    ).toBeTruthy();
  });
});

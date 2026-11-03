import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MyPractices } from "@/components/MyPractices";
import type { LocalDate } from "@/lib/dates";
import { createProgress, withDay, type Progress } from "@/lib/progress";
import type { ProgressStore } from "@/lib/storage/progress-store";
import { renderWithIntl } from "../render";

const day1 = "2026-11-01" as LocalDate;

function memoryStore(list: Progress[]): ProgressStore & { items: Progress[] } {
  const store = {
    items: [...list],
    get: async (id: string) =>
      store.items.find((p) => p.videoId === id) ?? null,
    list: async () => [...store.items],
    save: async (p: Progress) => {
      store.items = [...store.items.filter((x) => x.videoId !== p.videoId), p];
    },
    remove: vi.fn(async (id: string) => {
      store.items = store.items.filter((p) => p.videoId !== id);
    }),
  };
  return store;
}

const titles = {
  sintel: "Sintel",
  "tears-of-steel-1": "Tears of Steel · Part 1",
  bbb: "Big Buck",
};
const started = (id: string) =>
  withDay(createProgress(id, day1), 1, { done: true, date: day1, score: 0.9 });

async function renderPractices(store: ProgressStore) {
  await act(async () => {
    renderWithIntl(<MyPractices titles={titles} store={store} />);
  });
}

describe("MyPractices", () => {
  it("groups practices: in progress, waiting to repeat, passed", async () => {
    await renderPractices(
      memoryStore([
        { ...started("sintel"), status: "passed" },
        started("tears-of-steel-1"),
        { ...started("bbb"), status: "repeat" },
      ]),
    );
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual([
      "進行中1 支",
      "等待重新開始1 支",
      "已通過1 支",
    ]);
    const passed = screen.getByRole("region", { name: /已通過/ });
    expect(
      within(passed).getByRole("link", { name: "Sintel" }).getAttribute("href"),
    ).toBe("/videos/sintel");
  });

  it("removes a practice only after confirming", async () => {
    const store = memoryStore([started("sintel"), started("tears-of-steel-1")]);
    await renderPractices(store);
    const row = screen.getByRole("link", { name: "Sintel" }).closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "移除…" }));
    expect(within(row).getByText(/確定移除「Sintel」/)).toBeTruthy();

    fireEvent.click(within(row).getByRole("button", { name: "取消" }));
    expect(store.remove).not.toHaveBeenCalled();

    fireEvent.click(within(row).getByRole("button", { name: "移除…" }));
    await act(async () => {
      fireEvent.click(within(row).getByRole("button", { name: "移除進度" }));
    });
    expect(store.remove).toHaveBeenCalledWith("sintel");
    expect(screen.queryByRole("link", { name: "Sintel" })).toBeNull();
    expect(screen.getByText("已移除「Sintel」的練習進度。")).toBeTruthy();
  });

  it("says so when removing fails, keeping the practice", async () => {
    const store = memoryStore([started("sintel")]);
    vi.mocked(store.remove).mockRejectedValueOnce(new Error("blocked"));
    await renderPractices(store);
    fireEvent.click(screen.getByRole("button", { name: "移除…" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "移除進度" }));
    });
    expect(screen.getByText(/沒有成功移除「Sintel」/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sintel" })).toBeTruthy();
  });

  it("lists a video no longer in the library, so it can still be removed", async () => {
    await renderPractices(memoryStore([started("retired-video")]));
    expect(screen.getByText("（已下架的影片）")).toBeTruthy();
    expect(screen.getByRole("button", { name: "移除…" })).toBeTruthy();
  });

  it("points to the library when nothing is started", async () => {
    await renderPractices(memoryStore([]));
    expect(
      screen.getByRole("link", { name: "前往練習題庫 →" }).getAttribute("href"),
    ).toBe("/#library");
  });
});

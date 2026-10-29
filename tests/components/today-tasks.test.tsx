import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TodayTasks } from "@/components/TodayTasks";
import { settleWeek, type CycleDay } from "@/lib/cycle";
import { createProgress, withDay, type Progress } from "@/lib/progress";
import type { ProgressStore } from "@/lib/storage/progress-store";
import { renderWithIntl } from "../render";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const TODAY = "2026-10-29";
const YESTERDAY = "2026-10-28";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 29, 12));
});

afterEach(() => {
  vi.useRealTimers();
  push.mockClear();
});

function storeWith(progresses: Progress[]): ProgressStore & {
  saved: Progress[];
} {
  const saved: Progress[] = [];
  return {
    saved,
    get: async (id) => progresses.find((p) => p.videoId === id) ?? null,
    save: async (progress) => {
      saved.push(progress);
    },
    list: async () => progresses,
    remove: async () => {},
  };
}

function sintelWith(days: Partial<Record<CycleDay, string>>, day7Score = 0.5) {
  let progress = createProgress("sintel", "2026-10-20");
  for (const [key, date] of Object.entries(days)) {
    const day = Number(key) as CycleDay;
    progress = withDay(progress, day, {
      done: true,
      date,
      ...((day === 1 || day === 7) && { score: day === 7 ? day7Score : 0.5 }),
    });
  }
  return progress;
}

async function renderTasks(progresses: Progress[]) {
  const store = storeWith(progresses);
  renderWithIntl(<TodayTasks store={store} />);
  await act(async () => {});
  return store;
}

describe("TodayTasks", () => {
  it("points to the library when nothing has started", async () => {
    await renderTasks([]);
    expect(screen.getByRole("heading", { name: "今日任務" })).toBeDefined();
    expect(screen.getByText(/還沒有開始的練習/)).toBeDefined();
    expect(
      screen.getByRole("link", { name: /前往練習題庫/ }).getAttribute("href"),
    ).toBe("#library");
  });

  it("offers today's day with a start button", async () => {
    await renderTasks([sintelWith({ 1: YESTERDAY })]);
    const item = screen.getByRole("listitem");
    expect(item.textContent).toContain("Sintel｜第 2 天 跟讀");
    expect(item.textContent).toContain("可以做");
    expect(item.querySelector('[lang="en"]')!.textContent).toBe("Sintel");
    expect(
      screen.getByRole("link", { name: /開始/ }).getAttribute("href"),
    ).toBe("/videos/sintel/day/2");
  });

  it("shows a day done today, what opens tomorrow, and a retry", async () => {
    await renderTasks([sintelWith({ 1: YESTERDAY, 2: TODAY })]);
    const item = screen.getByRole("listitem");
    expect(item.textContent).toContain("✓ 已完成");
    expect(item.textContent).toContain("第 3 天明天開放");
    expect(
      screen.getByRole("link", { name: "再練一次" }).getAttribute("href"),
    ).toBe("/videos/sintel/day/2?retry=1");
  });

  it("starts a week to repeat again once it may", async () => {
    const days = {
      1: "2026-10-20",
      2: "2026-10-21",
      3: "2026-10-22",
      4: "2026-10-23",
      5: "2026-10-24",
      6: "2026-10-25",
      7: YESTERDAY,
    };
    const store = await renderTasks([settleWeek(sintelWith(days))]);
    expect(screen.getByRole("listitem").textContent).toContain(
      "Sintel｜第 2 週重新開始",
    );
    fireEvent.click(screen.getByRole("button", { name: /開始第 2 週/ }));
    await act(async () => {});
    expect(store.saved[0]).toMatchObject({ week: 2, status: "in-progress" });
    expect(push).toHaveBeenCalledWith("/videos/sintel/day/1");
  });
});

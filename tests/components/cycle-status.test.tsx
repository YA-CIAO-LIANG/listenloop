import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CycleStatus } from "@/components/CycleStatus";
import { DayGate } from "@/components/DayGate";
import { NextDayNote } from "@/components/NextDayNote";
import { VideoProgressLabel } from "@/components/VideoProgressLabel";
import { settleWeek, type CycleDay } from "@/lib/cycle";
import { createProgress, withDay, type Progress } from "@/lib/progress";
import type { ProgressStore } from "@/lib/storage/progress-store";
import { renderWithIntl } from "../render";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const TODAY = "2026-10-27";
const YESTERDAY = "2026-10-26";

/** Days 1..n done; the last one on `lastDate`, earlier ones before it. */
function doneThrough(n: number, lastDate: string): Progress {
  let progress = createProgress("sintel", "2026-10-01");
  for (let day = 1; day <= n; day++) {
    progress = withDay(progress, day as CycleDay, {
      done: true,
      date: day === n ? lastDate : `2026-10-${String(day).padStart(2, "0")}`,
      ...(day === 1 ? { score: 0.6 } : {}),
    });
  }
  return progress;
}

/** Days 1–7 done (Day 1 60%), Day 7 scored and the week settled. */
function settled(day7Score: number, day7Date: string): Progress {
  const progress = withDay(doneThrough(6, "2026-10-20"), 7, {
    done: true,
    date: day7Date,
    score: day7Score,
  });
  return settleWeek(progress);
}

function storeWith(progress: Progress | null) {
  const store: ProgressStore = {
    get: vi.fn(async () => progress),
    save: vi.fn(async () => {}),
    list: vi.fn(async () => (progress ? [progress] : [])),
    remove: vi.fn(async () => {}),
  };
  return store;
}

const link = (name: string | RegExp) =>
  screen.getByRole("link", { name }).getAttribute("href");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 27, 12));
  push.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function renderStatus(progress: Progress | null) {
  renderWithIntl(<CycleStatus videoId="sintel" store={storeWith(progress)} />);
  await act(async () => {});
}

describe("CycleStatus (video page)", () => {
  it("starts with Day 1 and keeps the handout locked", async () => {
    await renderStatus(null);
    expect(link("開始第 1 天：聽寫")).toBe("/videos/sintel/day/1");
    expect(screen.getByText("雙語講義：完成第 1 天後開放")).toBeDefined();
    expect(screen.getByText("第 2 天，跟讀，未解鎖")).toBeDefined();
  });

  it("says the next day opens tomorrow once today's task is done", async () => {
    await renderStatus(doneThrough(1, TODAY));
    expect(screen.getByText("今日任務完成")).toBeDefined();
    expect(screen.getByText("第 2 天（跟讀）明天開放")).toBeDefined();
    expect(link("再練一次")).toBe("/videos/sintel/day/1?retry=1");
    expect(link("查看結果")).toBe("/videos/sintel/day/1");
    expect(link("看雙語講義")).toBe("/videos/sintel/handout");
  });

  it("opens the next day on a later calendar day", async () => {
    await renderStatus(doneThrough(2, YESTERDAY));
    expect(link("開始第 3 天：跟讀")).toBe("/videos/sintel/day/3");
    expect(screen.getByText("第 3 天，跟讀，今天")).toBeDefined();
    expect(screen.queryByText("測試模式：已略過日期限制")).toBeNull();
  });

  it("skips the date rule in test mode and says so", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEV_TEST_MODE", "true");
    await renderStatus(doneThrough(1, TODAY));
    expect(link("開始第 2 天：跟讀")).toBe("/videos/sintel/day/2");
    expect(screen.getByText("測試模式：已略過日期限制")).toBeDefined();
  });

  it("opens unlocked days from the tracker", async () => {
    await renderStatus(doneThrough(2, YESTERDAY));
    fireEvent.click(screen.getByRole("button", { name: /第 1 天/ }));
    expect(push).toHaveBeenLastCalledWith("/videos/sintel/day/1");
    fireEvent.click(screen.getByRole("button", { name: /第 3 天/ }));
    expect(push).toHaveBeenLastCalledWith("/videos/sintel/day/3");
    expect(screen.queryByRole("button", { name: /第 4 天/ })).toBeNull();
  });

  it("opens Day 7 after Day 6", async () => {
    await renderStatus(doneThrough(6, YESTERDAY));
    expect(link("開始第 7 天：重新聽寫")).toBe("/videos/sintel/day/7");
    fireEvent.click(screen.getByRole("button", { name: /第 7 天/ }));
    expect(push).toHaveBeenLastCalledWith("/videos/sintel/day/7");
  });

  it("shows a passed week with both scores", async () => {
    await renderStatus(settled(0.85, YESTERDAY));
    expect(screen.getByText("已通過")).toBeDefined();
    expect(screen.getByText("第 1 天 60% → 第 7 天 85%")).toBeDefined();
    expect(link("查看週結果")).toBe("/videos/sintel/day/7");
  });

  it("starts the next week from the day after a week that didn't pass", async () => {
    await renderStatus(settled(0.7, TODAY));
    expect(screen.getByText("這週沒通過（第 7 天 70%）")).toBeDefined();
    expect(screen.getByText("第 2 週明天開始")).toBeDefined();
    expect(screen.queryByRole("button", { name: /開始第 2 週/ })).toBeNull();
  });

  it("starts week 2: saves a fresh week and opens Day 1", async () => {
    const progress = settled(0.7, YESTERDAY);
    const store = storeWith(progress);
    renderWithIntl(<CycleStatus videoId="sintel" store={store} />);
    await act(async () => {});

    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: /開始第 2 週/ })),
    );
    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({
        week: 2,
        days: {},
        status: "in-progress",
        startedAt: TODAY,
        history: progress.history,
      }),
    );
    expect(push).toHaveBeenLastCalledWith("/videos/sintel/day/1");
  });

  it("shows the week from week 2", async () => {
    await renderStatus({ ...doneThrough(1, YESTERDAY), week: 2 });
    expect(screen.getByText("第 2 週")).toBeDefined();
  });
});

describe("DayGate (day pages)", () => {
  async function renderGate(day: CycleDay, progress: Progress | null) {
    const store = storeWith(progress);
    renderWithIntl(
      <DayGate videoId="sintel" videoTitle="Sintel" day={day} store={store}>
        <p>Practice</p>
      </DayGate>,
    );
    await act(async () => {});
    return store;
  }

  it("always opens Day 1", async () => {
    await renderGate(1, null);
    expect(screen.getByText("Practice")).toBeDefined();
  });

  it("asks to finish the previous day first", async () => {
    const store = await renderGate(3, doneThrough(1, YESTERDAY));
    expect(screen.queryByText("Practice")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "第 3 天尚未開放" }),
    ).toBeDefined();
    expect(screen.getByText("請先完成第 2 天。")).toBeDefined();
    expect(link("前往第 2 天")).toBe("/videos/sintel/day/2");
    expect(link("回影片頁")).toBe("/videos/sintel");
    expect(store.save).not.toHaveBeenCalled();
  });

  it("says to come back tomorrow when the previous day was done today", async () => {
    await renderGate(2, doneThrough(1, TODAY));
    expect(screen.queryByText("Practice")).toBeNull();
    expect(
      screen.getByText("第 1 天今天才完成，第 2 天明天開放。明天再來！"),
    ).toBeDefined();
    expect(screen.queryByRole("link", { name: /前往/ })).toBeNull();
  });

  it("opens an unlocked day", async () => {
    await renderGate(2, doneThrough(1, YESTERDAY));
    expect(screen.getByText("Practice")).toBeDefined();
  });

  it("keeps done days reachable", async () => {
    await renderGate(1, doneThrough(2, TODAY));
    expect(screen.getByText("Practice")).toBeDefined();
  });
});

describe("VideoProgressLabel (library cards)", () => {
  async function renderLabel(progress: Progress | null) {
    const { container } = renderWithIntl(
      <VideoProgressLabel videoId="sintel" store={storeWith(progress)} />,
    );
    await act(async () => {});
    return container.textContent;
  }

  it("shows nothing before the video is started", async () => {
    expect(await renderLabel(null)).toBe("");
  });

  it("shows the day to practice", async () => {
    expect(await renderLabel(doneThrough(2, YESTERDAY))).toBe("第 3 天：跟讀");
  });

  it("shows today's task done, with the week from week 2", async () => {
    expect(await renderLabel({ ...doneThrough(1, TODAY), week: 2 })).toBe(
      "第 2 週 · ✓ 今日任務完成",
    );
  });

  it("shows a week to repeat", async () => {
    expect(await renderLabel(settled(0.7, TODAY))).toBe(
      "第 1 週未通過 · 第 2 週明天開始",
    );
  });

  it("shows a passed video", async () => {
    expect(
      await renderLabel({ ...doneThrough(7, YESTERDAY), status: "passed" }),
    ).toBe("✓ 已通過");
  });
});

describe("NextDayNote (completion screens)", () => {
  function renderNote(day: CycleDay, progress: Progress) {
    const { container } = renderWithIntl(
      <NextDayNote videoId="sintel" day={day} progress={progress} />,
    );
    return container;
  }

  it("says the next day opens tomorrow", () => {
    renderNote(2, doneThrough(2, TODAY));
    expect(screen.getByText("第 3 天（跟讀）明天開放。")).toBeDefined();
  });

  it("links to the next day once it is open", () => {
    vi.stubEnv("NEXT_PUBLIC_DEV_TEST_MODE", "true");
    renderNote(2, doneThrough(2, TODAY));
    expect(link(/第 3 天已開放/)).toBe("/videos/sintel/day/3");
  });

  it("points to Day 7 and says nothing once the next day is done", () => {
    renderNote(6, doneThrough(6, TODAY));
    expect(screen.getByText("第 7 天（重新聽寫）明天開放。")).toBeDefined();
    expect(renderNote(1, doneThrough(3, YESTERDAY)).textContent).toBe("");
  });
});

import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DictationSession } from "@/components/DictationSession";
import { WeekResult } from "@/components/WeekResult";
import { settleWeek } from "@/lib/cycle";
import { toLocalDate } from "@/lib/dates";
import { createProgress, withDay, type Progress } from "@/lib/progress";
import type { ProgressStore } from "@/lib/storage/progress-store";
import type { Video } from "@/lib/videos";
import { renderWithIntl } from "../render";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/youtube/useYouTubePlayer", () => ({
  useYouTubePlayer: () => ({
    containerRef: () => {},
    status: "ready",
    error: null,
    isPlaying: false,
    playSegment: vi.fn(),
    stop: vi.fn(),
  }),
}));

const video: Video = {
  id: "test-video",
  youtubeId: "abcdefghijk",
  title: "Test",
  level: "beginner",
  category: "story",
  collection: "blender-open-movies",
  source: "Test",
  attribution: {
    credit: "Test",
    license: "Public Domain",
    licenseUrl: "https://example.com/license",
    sourceUrl: "https://example.com/source",
    transcriptUrl: "https://example.com/transcript",
    changes: "None",
  },
  sentences: [
    { i: 0, start: 1, end: 2, en: "Go home.", zh: "回家。" },
    {
      i: 1,
      start: 3,
      end: 5,
      en: "We moved to the city.",
      zh: "我們搬到城市。",
    },
  ],
  vocab: [],
  grammar: [],
};

function memoryStore(initial: Progress) {
  let saved = initial;
  const store: ProgressStore & { saved: () => Progress } = {
    get: vi.fn(async () => saved),
    save: vi.fn(async (progress: Progress) => {
      saved = progress;
    }),
    list: vi.fn(async () => [saved]),
    remove: vi.fn(async () => {}),
    saved: () => saved,
  };
  return store;
}

/** Days 1–6 done long ago; Day 1 typed "go home" and nothing for sentence 2. */
function readyForDay7(): Progress {
  let progress = createProgress(video.id, "2026-10-01");
  progress = withDay(progress, 1, {
    done: true,
    date: "2026-10-01",
    score: 2 / 7,
    answers: ["go home", ""],
  });
  for (const day of [2, 3, 4, 5, 6] as const) {
    progress = withDay(progress, day, { done: true, date: `2026-10-0${day}` });
  }
  return progress;
}

/** A settled week; Day 7 typed `answer2` for sentence 2 on `day7Date`. */
function settled(answer2: string, day7Score: number, day7Date: string) {
  return settleWeek(
    withDay(readyForDay7(), 7, {
      done: true,
      date: day7Date,
      score: day7Score,
      answers: ["go home", answer2],
    }),
  );
}

const input = () => screen.getByRole("textbox", { name: "你聽到的句子" });

beforeEach(() => push.mockClear());

describe("Day 7 re-dictation", () => {
  async function renderDay7(store: ReturnType<typeof memoryStore>) {
    renderWithIntl(
      <DictationSession
        video={video}
        day={7}
        title="第 7 天：重新聽寫"
        store={store}
      />,
    );
    await act(async () => {});
  }

  it("ends with the week result and settles the week", async () => {
    const store = memoryStore(readyForDay7());
    await renderDay7(store);
    await userEvent.type(input(), "go home{Enter}");
    // Notes show on Day 7 too.
    expect(screen.getByText("回家。")).toBeDefined();
    await userEvent.keyboard("{Enter}");
    await userEvent.type(input(), "we moved to the city{Enter}");
    await userEvent.keyboard("{Enter}");

    expect(store.saved().status).toBe("passed");
    expect(screen.getByRole("heading", { name: "第 1 週結果" })).toBeDefined();
    expect(screen.getByText("進步 71 個百分點")).toBeDefined();
    expect(screen.getByText("通過！這支影片的七天循環完成了。")).toBeDefined();
  });

  it("keeps the retry screen for extra practice after the week", async () => {
    const done = settled("we moved to the city", 1, "2026-10-07");
    const store = memoryStore(done);
    renderWithIntl(
      <DictationSession
        video={video}
        day={7}
        title="第 7 天：重新聽寫"
        store={store}
        startInRetry
      />,
    );
    await act(async () => {});
    await userEvent.type(input(), "x{Enter}");
    await userEvent.keyboard("{Enter}");
    await userEvent.type(input(), "x{Enter}");
    await userEvent.keyboard("{Enter}");

    expect(screen.getByText("練習完成！")).toBeDefined();
    expect(screen.queryByRole("heading", { name: "第 1 週結果" })).toBeNull();
    expect(store.saved()).toBe(done);
  });
});

describe("WeekResult", () => {
  it("compares Day 1 and Day 7, sentence by sentence", () => {
    const progress = settled("we moved to the city", 1, "2026-10-07");
    renderWithIntl(
      <WeekResult
        video={video}
        progress={progress}
        store={memoryStore(progress)}
      />,
    );
    expect(screen.getByText("29%")).toBeDefined();
    expect(screen.getByText("進步 71 個百分點")).toBeDefined();
    expect(
      screen.getByRole("link", { name: "選下一支影片" }).getAttribute("href"),
    ).toBe("/");

    const rows = within(
      screen.getByRole("heading", { name: "逐句比較" }).parentElement!,
    ).getAllByRole("listitem");
    expect(rows[0].textContent).toContain("第 1 天 100% → 第 7 天 100%");
    expect(rows[0].textContent).not.toContain("（進步）");
    expect(rows[1].textContent).toContain("第 1 天 0% → 第 7 天 100%");
    expect(rows[1].textContent).toContain("（進步）");
  });

  it("says the next week starts tomorrow on the day it didn't pass", () => {
    const progress = settled("", 2 / 7, toLocalDate(new Date()));
    renderWithIntl(
      <WeekResult
        video={video}
        progress={progress}
        store={memoryStore(progress)}
      />,
    );
    expect(screen.getByText(/還差一點/)).toBeDefined();
    expect(screen.getByText("第 2 週明天開始")).toBeDefined();
    expect(screen.getByText("和第 1 天一樣")).toBeDefined();
  });

  it("starts the next week from the following day", async () => {
    const progress = settled("", 2 / 7, "2026-10-07");
    const store = memoryStore(progress);
    renderWithIntl(
      <WeekResult video={video} progress={progress} store={store} />,
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: /開始第 2 週/ })),
    );
    expect(store.saved()).toMatchObject({
      week: 2,
      days: {},
      status: "in-progress",
    });
    expect(push).toHaveBeenLastCalledWith("/videos/test-video/day/1");
  });

  it("lists earlier weeks", () => {
    const week1 = settled("", 2 / 7, "2026-10-07");
    const progress: Progress = {
      ...settled("we moved to the city", 1, "2026-10-14"),
      week: 2,
      history: [
        ...week1.history,
        { ...week1.history[0], week: 2, day7Score: 1, passed: true },
      ],
    };
    renderWithIntl(
      <WeekResult
        video={video}
        progress={progress}
        store={memoryStore(progress)}
      />,
    );
    expect(screen.getByRole("heading", { name: "第 2 週結果" })).toBeDefined();
    expect(
      screen.getByText("第 1 週 · 第 1 天 29% → 第 7 天 29% · 未通過"),
    ).toBeDefined();
  });
});

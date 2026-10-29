import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DictationSession } from "@/components/DictationSession";
import { PracticeCalendar } from "@/components/PracticeCalendar";
import { emptyActivity, recordTask, type Activity } from "@/lib/activity";
import { toLocalDate } from "@/lib/dates";
import type { Progress } from "@/lib/progress";
import { ACTIVITY_KEY } from "@/lib/storage/local-reward-store";
import type { ProgressStore } from "@/lib/storage/progress-store";
import type { RewardStore } from "@/lib/storage/reward-store";
import { emptyWallet } from "@/lib/wallet";
import type { Video } from "@/lib/videos";
import { renderWithIntl } from "../render";

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

const now = new Date();
const today = toLocalDate(now);
/** Another day in this month (the 1st, or the 2nd when today is the 1st). */
const otherDay = toLocalDate(
  new Date(now.getFullYear(), now.getMonth(), now.getDate() === 1 ? 2 : 1),
);
const dayName = (date: string) => {
  const d = new Date(`${date}T12:00:00`);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};

function memoryProgress(initial: Progress | null = null): ProgressStore {
  let saved = initial;
  return {
    get: async () => saved,
    save: async (progress) => {
      saved = progress;
    },
    list: async () => (saved ? [saved] : []),
    remove: async () => {},
  };
}

function rewardStore(activity: Activity): RewardStore {
  return {
    getWallet: async () => emptyWallet(),
    saveWallet: async () => {},
    getActivity: async () => activity,
    saveActivity: async () => {},
  };
}

async function renderCalendar(activity: Activity) {
  renderWithIntl(
    <PracticeCalendar
      progress={memoryProgress()}
      rewards={rewardStore(activity)}
    />,
  );
  await act(async () => {});
}

describe("PracticeCalendar", () => {
  const practiced = recordTask(
    recordTask(emptyActivity(), today, { videoId: "sintel", week: 1, day: 1 }),
    today,
    { videoId: "sintel", week: 1, day: 2 },
  );

  it("colors days by tasks finished and marks today, Sunday first", async () => {
    await renderCalendar(practiced);
    const headers = screen
      .getAllByRole("columnheader")
      .map((th) => th.textContent);
    expect(headers).toHaveLength(7);
    expect(headers[0]).toBe("日");
    const todayButton = screen.getByRole("button", {
      name: `${dayName(today)}，完成 2 個任務（今天）`,
    });
    expect(todayButton.dataset.level).toBe("2");
    expect(
      screen.getByRole("button", { name: `${dayName(otherDay)}，沒有完成任務` })
        .dataset.level,
    ).toBe("0");
  });

  it("explains the colors with a less → more legend", async () => {
    const { container } = renderWithIntl(
      <PracticeCalendar
        progress={memoryProgress()}
        rewards={rewardStore(practiced)}
      />,
    );
    await act(async () => {});
    const legend = container.querySelectorAll("[data-legend-level]");
    expect(
      [...legend].map((el) => el.getAttribute("data-legend-level")),
    ).toEqual(["0", "1", "2", "3", "4"]);
    expect(legend[0].parentElement!.textContent).toBe("少多");
    expect(
      screen.getByRole("table").querySelector("caption")!.textContent,
    ).toMatch(/顏色越深/);
  });

  it("on phones, shows this week until the month is expanded", async () => {
    await renderCalendar(practiced);
    const rows = screen.getByRole("table").querySelectorAll("tbody tr");
    const hidden = () =>
      [...rows].filter((row) => row.classList.contains("hidden")).length;
    expect(hidden()).toBe(rows.length - 1);
    const toggle = screen.getByRole("button", { name: /展開整月/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(hidden()).toBe(0);
    expect(
      screen
        .getByRole("button", { name: /收合/ })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("lists today's tasks under the calendar by default", async () => {
    await renderCalendar(practiced);
    const list = screen.getByRole("heading", { level: 3 }).parentElement!;
    expect(list.textContent).toContain("Sintel｜第 1 天 聽寫");
    expect(list.textContent).toContain("Sintel｜第 2 天 跟讀");
    for (const title of within(list).getAllByText("Sintel")) {
      expect(title.getAttribute("lang")).toBe("en");
    }
  });

  it("shows a day's tasks in a tooltip when the mouse is over it", async () => {
    await renderCalendar(practiced);
    const button = screen.getByRole("button", { name: /（今天）/ });
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toContain("完成 2 個任務");
    expect(tip.textContent).toContain("Sintel｜第 2 天 跟讀");
    expect(button.getAttribute("aria-describedby")).toBe(tip.id);
    fireEvent.pointerLeave(button);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("doesn't pop a tooltip for touch; a tap lists that day below", async () => {
    await renderCalendar(practiced);
    const other = screen.getByRole("button", {
      name: new RegExp(dayName(otherDay)),
    });
    fireEvent.pointerEnter(other, { pointerType: "touch" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.click(other);
    expect(other.getAttribute("aria-pressed")).toBe("true");
    const list = screen.getByRole("heading", { level: 3 }).parentElement!;
    expect(list.textContent).toContain("這天沒有完成任務");
  });

  it("moves between months", async () => {
    await renderCalendar(practiced);
    const month = () => screen.getByRole("heading", { level: 2 }).textContent;
    const start = month();
    fireEvent.click(screen.getByRole("button", { name: /上個月/ }));
    expect(month()).not.toBe(start);
    expect(screen.queryByRole("button", { name: /（今天）/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /下個月/ }));
    expect(month()).toBe(start);
  });
});

describe("practice log", () => {
  const video: Video = {
    id: "test-video",
    youtubeId: "abcdefghijk",
    title: "Test",
    level: "beginner",
    category: "story",
    source: "Test",
    attribution: {
      credit: "Test",
      license: "Public Domain",
      licenseUrl: "https://example.com/license",
      sourceUrl: "https://example.com/source",
      transcriptUrl: "https://example.com/transcript",
      changes: "None",
    },
    sentences: [{ i: 0, start: 1, end: 2, en: "Go home.", zh: "回家。" }],
    vocab: [],
    grammar: [],
  };

  it("notes a finished official day even with the reward features off", async () => {
    renderWithIntl(
      <DictationSession
        video={video}
        day={1}
        title="第 1 天"
        store={memoryProgress()}
      />,
    );
    await act(async () => {});
    await userEvent.type(
      screen.getByRole("textbox", { name: "你聽到的句子" }),
      "go home{Enter}",
    );
    await act(async () => {});
    const saved = JSON.parse(localStorage.getItem(ACTIVITY_KEY) ?? "null");
    expect(saved.days[today].tasks).toEqual([
      { videoId: "test-video", week: 1, day: 1 },
    ]);
  });
});

import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListenSession } from "@/components/ListenSession";
import { LISTEN_STORAGE_KEY, SENTENCE_GAP_MS } from "@/lib/listen";
import type { PracticeMaterial } from "@/lib/practice-material";
import { renderWithIntl } from "../render";

/** Listening mode (D135), on an audio material with stand-in playback. */
const playSentence = vi.hoisted(() => vi.fn());
const stop = vi.hoisted(() => vi.fn());
vi.mock("@/components/audio/useAudioPlayer", () => ({
  useAudioPlayer: () => ({
    status: "ready",
    error: null,
    isPlaying: false,
    playSentence,
    stop,
  }),
}));
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

const material: PracticeMaterial = {
  id: "p-0b1d2c3e-4f50-4a6b-8c7d-9e0f1a2b3c4d",
  title: "Morning",
  sentences: [
    { i: 0, start: 0, end: 0, en: "Good morning.", zh: "早安。" },
    {
      i: 1,
      start: 0,
      end: 0,
      en: "We moved to the city.",
      zh: "我們搬到城市。",
    },
    { i: 2, start: 0, end: 0, en: "It was quiet.", zh: "很安靜。" },
  ],
  vocab: [],
  grammar: [],
  audioUrls: ["a.mp3", "b.mp3", "c.mp3"],
};

function progress(day1Done: boolean) {
  return JSON.stringify({
    videoId: material.id,
    week: 1,
    startedAt: "2026-11-10",
    status: "in-progress",
    history: [],
    days: day1Done
      ? {
          "1": {
            done: true,
            score: 0.8,
            date: "2026-11-10",
            answers: ["good morning", "we moved to the town", "it was quiet"],
          },
        }
      : {},
  });
}

beforeEach(() => {
  localStorage.clear();
  playSentence.mockReset();
  stop.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  vi.useRealTimers();
});

const open = async () => {
  localStorage.setItem(`ll-progress:v1:${material.id}`, progress(true));
  renderWithIntl(<ListenSession video={material} />);
  await screen.findByRole("button", { name: "播放" });
};

describe("ListenSession (D135)", () => {
  it("stays locked until Day 1 is done", async () => {
    localStorage.setItem(`ll-progress:v1:${material.id}`, progress(false));
    renderWithIntl(<ListenSession video={material} />);
    expect(await screen.findByText(/完成第 1 天的聽寫後/)).toBeDefined();
    expect(
      screen.getByRole("link", { name: /前往第 1 天/ }).getAttribute("href"),
    ).toBe(`/videos/${material.id}/day/1`);
  });

  it("plays the text through, from any sentence", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await open();
    await act(async () => {
      fireEvent.click(
        screen
          .getAllByRole("button")
          .find((b) => b.textContent?.includes("We moved"))!,
      );
    });
    expect(playSentence).toHaveBeenLastCalledWith(1, expect.any(Function));
    const onEnd = playSentence.mock.calls.at(-1)![1] as () => void;
    act(() => {
      onEnd();
      vi.advanceTimersByTime(SENTENCE_GAP_MS);
    });
    expect(playSentence).toHaveBeenLastCalledWith(2, expect.any(Function));
    expect(screen.getByText("第 3 句／共 3 句")).toBeDefined();
  });

  it("begins at the sentence asked for (?s=, from the review, D145)", async () => {
    localStorage.setItem(`ll-progress:v1:${material.id}`, progress(true));
    renderWithIntl(<ListenSession video={material} start={2} />);
    expect(await screen.findByText("第 3 句／共 3 句")).toBeDefined();
    renderWithIntl(<ListenSession video={material} start={99} />);
    expect(await screen.findByText("第 1 句／共 3 句")).toBeDefined();
  });

  it("switches subtitles and remembers the choice", async () => {
    await open();
    expect(screen.getByText("早安。")).toBeDefined();
    fireEvent.click(screen.getByLabelText("盲聽"));
    expect(screen.queryByText("早安。")).toBeNull();
    expect(screen.queryByText("Good morning.")).toBeNull();
    expect(screen.getByText("第 1 句")).toBeDefined();
    expect(JSON.parse(localStorage.getItem(LISTEN_STORAGE_KEY)!)).toMatchObject(
      { subtitles: "blind" },
    );
    fireEvent.click(screen.getByLabelText("只有中文"));
    expect(screen.getByText("早安。")).toBeDefined();
    expect(screen.queryByText("Good morning.")).toBeNull();
  });

  it("runs the three passes: blind first", async () => {
    await open();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "三遍聽法" }));
    });
    expect(screen.getByText("第 1 遍／共 3 遍：盲聽")).toBeDefined();
    expect(playSentence).toHaveBeenLastCalledWith(0, expect.any(Function));
    expect(screen.queryByText("早安。")).toBeNull();
  });

  it("marks the words misheard on Day 1", async () => {
    await open();
    const marked = document.querySelectorAll("mark");
    expect([...marked].some((m) => m.textContent?.includes("city"))).toBe(true);
    expect(screen.getByText(/螢光筆標示的是/)).toBeDefined();
  });

  it("plays and pauses with Space, and moves with the arrow keys", async () => {
    await open();
    await act(async () => {
      fireEvent.keyDown(window, { key: " " });
    });
    expect(playSentence).toHaveBeenLastCalledWith(0, expect.any(Function));
    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowRight" });
    });
    expect(playSentence).toHaveBeenLastCalledWith(1, expect.any(Function));
    await act(async () => {
      fireEvent.keyDown(window, { key: " " });
    });
    expect(stop).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "播放" })).toBeDefined();
  });
});

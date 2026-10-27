import { act, render, renderHook, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSentencePlayback } from "@/components/useSentencePlayback";
import { VideoAttribution } from "@/components/VideoAttribution";
import {
  READY_TIMEOUT_MS,
  useYouTubePlayer,
  type YouTubePlayerApi,
} from "@/components/youtube/useYouTubePlayer";
import { videos } from "@/data/videos";
import { renderWithIntl } from "../render";

/** Stand-in for YT.Player: records calls and lets tests set the time. */
class FakePlayer {
  static last: FakePlayer;
  /** Set to false to simulate a blocked iframe that never becomes ready. */
  static autoReady = true;
  time = 0;
  calls: string[] = [];
  constructor(
    _element: HTMLElement,
    public options: YT.PlayerOptions,
  ) {
    FakePlayer.last = this;
    if (FakePlayer.autoReady) {
      queueMicrotask(() => options.events?.onReady?.({} as YT.PlayerEvent));
    }
  }
  seekTo(seconds: number) {
    this.calls.push(`seekTo:${seconds}`);
  }
  playVideo() {
    this.calls.push("play");
  }
  pauseVideo() {
    this.calls.push("pause");
  }
  getCurrentTime() {
    return this.time;
  }
  destroy() {
    this.calls.push("destroy");
  }
}

const fakeApi = {
  Player: FakePlayer,
  PlayerState: { PLAYING: 1 },
  PlayerError: { EmbeddingNotAllowed: 101, EmbeddingNotAllowed2: 150 },
};

const loadYouTubeApi = vi.hoisted(() => vi.fn());
vi.mock("@/components/youtube/loadYouTubeApi", () => ({ loadYouTubeApi }));

// The hook's latest return value, handed out after each render (not during).
let api: YouTubePlayerApi;
function Harness({ videoId = "abcdefghijk" }) {
  const player = useYouTubePlayer(videoId);
  const { containerRef } = player;
  useEffect(() => {
    api = player;
  });
  return <div ref={containerRef} />;
}

async function renderReadyPlayer() {
  render(<Harness />);
  await act(async () => {}); // API load + onReady microtasks
  expect(api.status).toBe("ready");
  return FakePlayer.last;
}

describe("useYouTubePlayer", () => {
  beforeEach(() => {
    loadYouTubeApi.mockResolvedValue(fakeApi);
    FakePlayer.autoReady = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a privacy-friendly player with captions off", async () => {
    const player = await renderReadyPlayer();
    expect(player.options).toMatchObject({
      host: "https://www.youtube-nocookie.com",
      videoId: "abcdefghijk",
      playerVars: { cc_load_policy: 0, playsinline: 1 },
    });
  });

  it("plays a segment and pauses at its end", async () => {
    const player = await renderReadyPlayer();
    vi.useFakeTimers();

    act(() => api.playSegment(107.25, 110.5));
    expect(player.calls).toEqual(["seekTo:107.25", "play"]);

    player.time = 109;
    vi.advanceTimersByTime(100);
    expect(player.calls).not.toContain("pause");

    player.time = 110.55;
    vi.advanceTimersByTime(100);
    expect(player.calls.filter((c) => c === "pause")).toHaveLength(1);
  });

  it("calls onEnd once after pausing at the segment end", async () => {
    const player = await renderReadyPlayer();
    vi.useFakeTimers();
    const onEnd = vi.fn();
    act(() => api.playSegment(10, 12, onEnd));
    player.time = 11;
    vi.advanceTimersByTime(100);
    expect(onEnd).not.toHaveBeenCalled();
    player.time = 12.1;
    vi.advanceTimersByTime(300);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("doesn't call onEnd when another segment starts first", async () => {
    const player = await renderReadyPlayer();
    vi.useFakeTimers();
    const first = vi.fn();
    act(() => api.playSegment(10, 12, first));
    player.time = 11;
    vi.advanceTimersByTime(100);
    act(() => api.playSegment(20, 22));
    player.time = 22.5;
    vi.advanceTimersByTime(300);
    expect(first).not.toHaveBeenCalled();
  });

  it("ignores a stale time reported right after seeking", async () => {
    const player = await renderReadyPlayer();
    vi.useFakeTimers();
    player.time = 300; // still at the old position, past this segment's end

    act(() => api.playSegment(10, 12));
    vi.advanceTimersByTime(200);
    expect(player.calls).not.toContain("pause");

    player.time = 10.1;
    vi.advanceTimersByTime(100);
    player.time = 12.05;
    vi.advanceTimersByTime(100);
    expect(player.calls).toContain("pause");
  });

  it("starting another segment cancels the previous stop timer", async () => {
    const player = await renderReadyPlayer();
    vi.useFakeTimers();
    act(() => api.playSegment(10, 12));
    player.time = 10.5;
    vi.advanceTimersByTime(100);

    act(() => api.playSegment(20, 25));
    player.time = 12.5; // past the old end, before the new start
    vi.advanceTimersByTime(100);
    expect(player.calls).not.toContain("pause");
  });

  it.each([
    [150, "embedBlocked"],
    [101, "embedBlocked"],
    [100, "unavailable"],
  ])("maps YouTube error %s to %s", async (code, expected) => {
    const player = await renderReadyPlayer();
    act(() =>
      player.options.events?.onError?.({ data: code } as YT.OnErrorEvent),
    );
    expect(api.status).toBe("error");
    expect(api.error).toBe(expected);
  });

  it("reports a blocked player that never becomes ready", async () => {
    vi.useFakeTimers();
    FakePlayer.autoReady = false;
    render(<Harness />);
    await act(async () => {});
    expect(api.status).toBe("loading");

    act(() => vi.advanceTimersByTime(READY_TIMEOUT_MS - 1));
    expect(api.status).toBe("loading");
    act(() => vi.advanceTimersByTime(1));
    expect(api.status).toBe("error");
    expect(api.error).toBe("blocked");
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/^\[YouTube\] player not ready after 15 s/),
    );
  });

  it("doesn't time out once the player is ready", async () => {
    vi.useFakeTimers();
    render(<Harness />);
    await act(async () => {});
    act(() => vi.advanceTimersByTime(READY_TIMEOUT_MS * 2));
    expect(api.status).toBe("ready");
    expect(console.error).not.toHaveBeenCalled();
  });

  it("logs YouTube error codes to the console", async () => {
    const player = await renderReadyPlayer();
    act(() =>
      player.options.events?.onError?.({ data: 150 } as YT.OnErrorEvent),
    );
    expect(console.error).toHaveBeenCalledWith(
      "[YouTube] player error 150 (embedding not allowed) (video abcdefghijk)",
    );
  });

  it("reports when the YouTube script can't load", async () => {
    loadYouTubeApi.mockRejectedValue(new Error("blocked"));
    render(<Harness />);
    await act(async () => {});
    expect(api.status).toBe("error");
    expect(api.error).toBe("loadFailed");
    expect(console.error).toHaveBeenCalledWith(
      "[YouTube] IFrame API failed to load: blocked (video abcdefghijk)",
    );
  });

  it("destroys the player on unmount", async () => {
    const { unmount } = render(<Harness />);
    await act(async () => {});
    const player = FakePlayer.last;
    unmount();
    expect(player.calls).toContain("destroy");
  });
});

describe("useSentencePlayback", () => {
  const { sentences } = videos.find((v) => v.id === "sintel")!;

  it("plays the padded sentence and tracks whether it was played", () => {
    const playSegment = vi.fn();
    // Sentence 3 is 118–121.45; neighbors end at 115.8 and start at 121.75.
    const { result, rerender } = renderHook(
      ({ index }) => useSentencePlayback({ playSegment }, sentences, index),
      { initialProps: { index: 2 } },
    );
    expect(result.current.played).toBe(false);

    act(() => result.current.play());
    expect(playSegment).toHaveBeenLastCalledWith(117.85, 121.7, undefined);
    expect(result.current.played).toBe(true);

    // Moving on resets "played" for the new sentence.
    rerender({ index: 3 });
    expect(result.current.played).toBe(false);
  });

  it("plays another sentence with playAt (auto-play next)", () => {
    const playSegment = vi.fn();
    const { result } = renderHook(() =>
      useSentencePlayback({ playSegment }, sentences, 2),
    );
    // Sentence 4 is 121.75–124.8; the previous one ends at 121.45.
    act(() => result.current.playAt(3));
    expect(playSegment).toHaveBeenLastCalledWith(121.6, 125.05, undefined);
  });

  it("accepts custom padding", () => {
    const playSegment = vi.fn();
    const { result } = renderHook(() =>
      useSentencePlayback({ playSegment }, sentences, 2, {
        before: 0,
        after: 0,
      }),
    );
    act(() => result.current.play());
    expect(playSegment).toHaveBeenLastCalledWith(118, 121.45, undefined);
  });
});

describe("VideoAttribution", () => {
  it("shows the credit, license link, and changes for Sintel", () => {
    const sintel = videos.find((v) => v.id === "sintel")!;
    renderWithIntl(<VideoAttribution attribution={sintel.attribution} />, "en");
    expect(
      screen.getByText("© copyright Blender Foundation | durian.blender.org"),
    ).toBeDefined();
    expect(
      screen.getByRole("link", { name: "CC BY 3.0" }).getAttribute("href"),
    ).toBe("https://creativecommons.org/licenses/by/3.0/");
    expect(screen.getByText(/Chinese translation/)).toBeDefined();
  });
});

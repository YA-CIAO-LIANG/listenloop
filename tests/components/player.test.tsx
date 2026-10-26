import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SentencePlayer } from "@/components/SentencePlayer";
import { VideoAttribution } from "@/components/VideoAttribution";
import {
  useYouTubePlayer,
  type YouTubePlayerApi,
} from "@/components/youtube/useYouTubePlayer";
import { videos } from "@/data/videos";
import { renderWithIntl } from "../render";

/** Stand-in for YT.Player: records calls and lets tests set the time. */
class FakePlayer {
  static last: FakePlayer;
  time = 0;
  calls: string[] = [];
  constructor(
    _element: HTMLElement,
    public options: YT.PlayerOptions,
  ) {
    FakePlayer.last = this;
    queueMicrotask(() => options.events?.onReady?.({} as YT.PlayerEvent));
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

  it("reports when the YouTube script can't load", async () => {
    loadYouTubeApi.mockRejectedValue(new Error("blocked"));
    render(<Harness />);
    await act(async () => {});
    expect(api.status).toBe("error");
    expect(api.error).toBe("loadFailed");
  });

  it("destroys the player on unmount", async () => {
    const { unmount } = render(<Harness />);
    await act(async () => {});
    const player = FakePlayer.last;
    unmount();
    expect(player.calls).toContain("destroy");
  });
});

describe("SentencePlayer", () => {
  const { sentences } = videos.find((v) => v.id === "sintel")!;
  const fakePlayer = (overrides: Partial<YouTubePlayerApi> = {}) => ({
    containerRef: { current: null },
    status: "ready" as const,
    error: null,
    isPlaying: false,
    playSegment: vi.fn(),
    stop: vi.fn(),
    ...overrides,
  });

  it("plays the padded sentence and offers a replay", async () => {
    const player = fakePlayer();
    // Sentence 3 is 118–121.45; neighbors end at 115.8 and start at 121.75.
    renderWithIntl(
      <SentencePlayer player={player} sentences={sentences} index={2} />,
    );
    expect(screen.getByText("第 3 句，共 12 句")).toBeDefined();
    // Speed switching was removed from the product.
    expect(screen.queryByRole("radio")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "播放這句" }));
    expect(player.playSegment).toHaveBeenLastCalledWith(117.85, 121.7);

    await userEvent.click(screen.getByRole("button", { name: "再聽一次" }));
    expect(player.playSegment).toHaveBeenCalledTimes(2);
  });

  it("keeps the padding inside the neighboring sentences", async () => {
    const player = fakePlayer();
    // Sentence 4 is 121.75–124.8; the previous one ends at 121.45.
    renderWithIntl(
      <SentencePlayer player={player} sentences={sentences} index={3} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "播放這句" }));
    expect(player.playSegment).toHaveBeenLastCalledWith(121.6, 125.05);
  });

  it("accepts custom padding", async () => {
    const player = fakePlayer();
    renderWithIntl(
      <SentencePlayer
        player={player}
        sentences={sentences}
        index={2}
        padding={{ before: 0, after: 0 }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "播放這句" }));
    expect(player.playSegment).toHaveBeenLastCalledWith(118, 121.45);
  });

  it("is disabled until the player is ready", () => {
    renderWithIntl(
      <SentencePlayer
        player={fakePlayer({ status: "loading" })}
        sentences={sentences}
        index={2}
      />,
    );
    expect(
      screen.getByRole("button", { name: "播放這句" }).hasAttribute("disabled"),
    ).toBe(true);
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

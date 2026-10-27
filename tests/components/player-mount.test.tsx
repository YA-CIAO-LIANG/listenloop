import { act, render } from "@testing-library/react";
import { useEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useYouTubePlayer } from "@/components/youtube/useYouTubePlayer";

/** Minimal YT.Player stand-in that records creation. */
const created = vi.hoisted(() => [] as string[]);
class FakePlayer {
  constructor(_element: HTMLElement, options: YT.PlayerOptions) {
    created.push(options.videoId ?? "");
    queueMicrotask(() => options.events?.onReady?.({} as YT.PlayerEvent));
  }
  destroy() {}
}
const loadYouTubeApi = vi.hoisted(() => vi.fn());
vi.mock("@/components/youtube/loadYouTubeApi", () => ({ loadYouTubeApi }));
loadYouTubeApi.mockResolvedValue({
  Player: FakePlayer,
  PlayerState: { PLAYING: 1 },
  PlayerError: { EmbeddingNotAllowed: 101, EmbeddingNotAllowed2: 150 },
});

let status = "";
let showPlayer: (show: boolean) => void = () => {};

/**
 * Like the dictation page: the player's container only appears after
 * something else has loaded (saved progress), not on the first render.
 */
function LateContainer() {
  const player = useYouTubePlayer("abcdefghijk");
  const { containerRef } = player;
  const [visible, setVisible] = useState(false);
  // Hand values to the test after render, not during it.
  useEffect(() => {
    showPlayer = setVisible;
    status = player.status;
  }, [player.status]);
  return visible ? <div ref={containerRef} /> : <p>Loading progress…</p>;
}

describe("useYouTubePlayer with a container that appears later", () => {
  it("creates the player once the container is attached", async () => {
    created.length = 0;
    render(<LateContainer />);
    await act(async () => {}); // API loaded while there's no container yet
    expect(created).toEqual([]);

    await act(async () => showPlayer(true));
    expect(created).toEqual(["abcdefghijk"]);
    expect(status).toBe("ready");
  });
});

describe("dictation page with the real player hook", () => {
  it("creates the player after saved progress has loaded", async () => {
    const { DictationSession } = await import("@/components/DictationSession");
    const { renderWithIntl } = await import("../render");
    const { videos } = await import("@/data/videos");
    const sintel = videos.find((v) => v.id === "sintel")!;

    created.length = 0;
    let resolveProgress: (value: null) => void = () => {};
    const store = {
      get: () =>
        new Promise<null>((resolve) => {
          resolveProgress = resolve;
        }),
      save: async () => {},
      list: async () => [],
      remove: async () => {},
    };

    renderWithIntl(
      <DictationSession video={sintel} day={1} title="Day 1" store={store} />,
    );
    await act(async () => {}); // API loaded, progress still loading
    expect(created).toEqual([]);

    await act(async () => resolveProgress(null)); // progress arrives
    expect(created).toEqual([sintel.youtubeId]);
  });
});

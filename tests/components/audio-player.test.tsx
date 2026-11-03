import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAudioPlayer } from "@/components/audio/useAudioPlayer";
import { useSentencePlayer } from "@/components/useSentencePlayer";
import { videos } from "@/data/videos";

const playSegment = vi.hoisted(() => vi.fn());
vi.mock("@/components/youtube/useYouTubePlayer", () => ({
  useYouTubePlayer: () => ({
    containerRef: () => {},
    status: "ready",
    error: null,
    isPlaying: false,
    playSegment,
    stop: vi.fn(),
  }),
}));

/** Just enough of <audio> to drive the hook: events, src, play, pause. */
class FakeAudio extends EventTarget {
  static last: FakeAudio;
  src = "";
  currentTime = 5;
  preload = "";
  currentSrc = "";
  plays: string[] = [];
  constructor() {
    super();
    FakeAudio.last = this;
  }
  play() {
    this.plays.push(this.src);
    this.dispatchEvent(new Event("playing"));
    return Promise.resolve();
  }
  pause() {
    this.dispatchEvent(new Event("pause"));
  }
  removeAttribute() {
    this.src = "";
  }
  load() {}
  emit(type: string) {
    act(() => {
      this.dispatchEvent(new Event(type));
    });
  }
}

const urls = ["https://cdn.test/a.wav", "https://cdn.test/b.wav"];

beforeEach(() => {
  vi.stubGlobal("Audio", FakeAudio);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useAudioPlayer", () => {
  it("is ready once the first file's metadata loads", () => {
    const { result } = renderHook(() => useAudioPlayer(urls));
    expect(result.current.status).toBe("loading");
    expect(FakeAudio.last.src).toBe(urls[0]);
    FakeAudio.last.emit("loadedmetadata");
    expect(result.current.status).toBe("ready");
  });

  it("reports a file that can't load", () => {
    const { result } = renderHook(() => useAudioPlayer(urls));
    FakeAudio.last.emit("error");
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("loadFailed");
  });

  it("plays a sentence's file from the start and calls onEnd when it ends", () => {
    const { result } = renderHook(() => useAudioPlayer(urls));
    const audio = FakeAudio.last;
    const onEnd = vi.fn();
    act(() => result.current.playSentence(1, onEnd));
    expect(audio.plays).toEqual([urls[1]]);
    expect(audio.currentTime).toBe(0);
    expect(result.current.isPlaying).toBe(true);
    audio.emit("ended");
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(result.current.isPlaying).toBe(false);
  });

  it("doesn't call onEnd after stop, or for a play that was replaced", () => {
    const { result } = renderHook(() => useAudioPlayer(urls));
    const audio = FakeAudio.last;
    const stopped = vi.fn();
    act(() => result.current.playSentence(0, stopped));
    act(() => result.current.stop());
    audio.emit("ended");
    expect(stopped).not.toHaveBeenCalled();

    const first = vi.fn();
    const second = vi.fn();
    act(() => result.current.playSentence(0, first));
    act(() => result.current.playSentence(1, second));
    audio.emit("ended");
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe("useSentencePlayer", () => {
  const sintel = videos.find((v) => v.id === "sintel")!;

  it("plays a YouTube sentence with padding", () => {
    const { result } = renderHook(() => useSentencePlayer(sintel));
    expect(result.current.kind).toBe("youtube");
    // Sentence 3 is 118–121.45; neighbors end at 115.8 and start at 121.75.
    act(() => result.current.playSentence(2));
    expect(playSegment).toHaveBeenLastCalledWith(117.85, 121.7, undefined);
  });

  it("plays a created practice's own files", () => {
    const { result } = renderHook(() =>
      useSentencePlayer({
        id: "p-1",
        title: "Mine",
        sentences: [],
        vocab: [],
        grammar: [],
        audioUrls: urls,
      }),
    );
    expect(result.current.kind).toBe("audio");
    act(() => result.current.playSentence(1));
    expect(FakeAudio.last.plays).toEqual([urls[1]]);
  });
});

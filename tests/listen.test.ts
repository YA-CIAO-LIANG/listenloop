import { describe, expect, it, vi } from "vitest";
import {
  nextAfter,
  parseListenSettings,
  shownSubtitles,
  stepIndex,
} from "@/lib/listen";
import { setMediaPlaying, setUpMediaSession } from "@/lib/media-session";
import { isPracticing } from "@/lib/practice-time";

describe("listening mode (D135)", () => {
  it("plays on to the end, or loops one sentence or the whole text", () => {
    expect(nextAfter(0, 3, "off", null)).toEqual({ kind: "play", index: 1 });
    expect(nextAfter(2, 3, "off", null)).toEqual({ kind: "stop" });
    expect(nextAfter(1, 3, "one", null)).toEqual({ kind: "play", index: 1 });
    expect(nextAfter(2, 3, "all", null)).toEqual({ kind: "play", index: 0 });
    expect(nextAfter(0, 0, "all", null)).toEqual({ kind: "stop" });
  });

  it("runs the three passes through the whole text, then stops", () => {
    expect(nextAfter(0, 2, "one", 1)).toEqual({
      kind: "play",
      index: 1,
      pass: 1,
    });
    expect(nextAfter(1, 2, "off", 1)).toEqual({
      kind: "play",
      index: 0,
      pass: 2,
    });
    expect(nextAfter(1, 2, "all", 3)).toEqual({ kind: "stop" });
    expect(shownSubtitles("zh", 1)).toBe("blind");
    expect(shownSubtitles("zh", 2)).toBe("en");
    expect(shownSubtitles("zh", 3)).toBe("both");
    expect(shownSubtitles("zh", null)).toBe("zh");
  });

  it("steps within the text", () => {
    expect(stepIndex(0, 3, -1)).toBe(0);
    expect(stepIndex(1, 3, 1)).toBe(2);
    expect(stepIndex(2, 3, 1)).toBe(2);
  });

  it("remembers valid settings only", () => {
    expect(parseListenSettings('{"subtitles":"zh","loop":"all"}')).toEqual({
      subtitles: "zh",
      loop: "all",
    });
    expect(parseListenSettings('{"subtitles":"x"}')).toEqual({
      subtitles: "both",
      loop: "off",
    });
    expect(parseListenSettings("not json")).toEqual({
      subtitles: "both",
      loop: "off",
    });
  });

  it("never counts in the background, listening mode included (D181)", () => {
    const base = {
      visible: false,
      focused: false,
      playing: true,
      lastActive: 0,
      now: 10_000_000,
    };
    expect(isPracticing(base)).toBe(false);
    expect(isPracticing({ ...base, visible: true })).toBe(true);
  });
});

describe("Media Session (D135)", () => {
  it("shows the title and wires the lock screen's buttons", () => {
    const handlers = new Map<string, (() => void) | null>();
    const session = {
      metadata: null as unknown,
      playbackState: "none",
      setActionHandler: (action: string, handler: (() => void) | null) =>
        handlers.set(action, handler),
    } as unknown as MediaSession;
    vi.stubGlobal(
      "MediaMetadata",
      class {
        constructor(public init: { title: string }) {}
      },
    );
    const controls = {
      play: vi.fn(),
      pause: vi.fn(),
      previous: vi.fn(),
      next: vi.fn(),
    };
    const clean = setUpMediaSession(
      session,
      { title: "Sintel", artist: "ListenLoop", artwork: "/icon.png" },
      controls,
    );
    expect(
      (session.metadata as unknown as { init: { title: string } }).init.title,
    ).toBe("Sintel");
    handlers.get("nexttrack")?.();
    handlers.get("pause")?.();
    expect(controls.next).toHaveBeenCalled();
    expect(controls.pause).toHaveBeenCalled();
    setMediaPlaying(session, true);
    expect(session.playbackState).toBe("playing");
    clean();
    expect(handlers.get("play")).toBeNull();
    expect(session.metadata).toBeNull();
    vi.unstubAllGlobals();
  });

  it("does nothing without the API", () => {
    expect(() =>
      setUpMediaSession(
        undefined,
        { title: "x", artist: "y", artwork: "z" },
        { play() {}, pause() {}, previous() {}, next() {} },
      )(),
    ).not.toThrow();
  });
});

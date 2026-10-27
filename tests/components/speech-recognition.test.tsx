import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NETWORK_RETRY_LIMIT,
  NO_SPEECH_MS,
  SILENCE_MS,
  useSpeechRecognition,
} from "@/components/speech/useSpeechRecognition";

/** Stand-in for the browser's SpeechRecognition; tests drive its events. */
class FakeRecognition {
  static last: FakeRecognition;
  lang = "";
  interimResults = false;
  continuous = false;
  maxAlternatives = 0;
  started = false;
  stopped = false;
  aborted = false;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
  abort() {
    this.aborted = true;
  }
  /** Emit results as the browser does: a list of [{ transcript }] entries. */
  hear(...phrases: string[]) {
    this.onresult?.({
      results: phrases.map((transcript) => [{ transcript }]),
    });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  (
    window as unknown as { webkitSpeechRecognition: unknown }
  ).webkitSpeechRecognition = FakeRecognition;
});

afterEach(() => {
  vi.useRealTimers();
  delete (navigator as { brave?: unknown }).brave;
  delete (window as unknown as { webkitSpeechRecognition?: unknown })
    .webkitSpeechRecognition;
});

describe("useSpeechRecognition", () => {
  it("detects support in the browser", () => {
    const { result } = renderHook(() => useSpeechRecognition());
    expect(result.current.availability).toBe("available");
  });

  it("listens in English with interim results", () => {
    const { result } = renderHook(() => useSpeechRecognition());
    act(() => result.current.start(() => {}));
    const recognition = FakeRecognition.last;
    expect(recognition).toMatchObject({
      lang: "en-US",
      interimResults: true,
      continuous: true,
      started: true,
    });
    expect(result.current.status).toBe("listening");
  });

  it("shows interim words and finishes after a pause", () => {
    const onFinish = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition());
    act(() => result.current.start(onFinish));

    act(() => FakeRecognition.last.hear("it took", " a while"));
    expect(result.current.transcript).toBe("it took a while");
    act(() => vi.advanceTimersByTime(SILENCE_MS - 1));
    expect(onFinish).not.toHaveBeenCalled();

    // More speech resets the silence timer.
    act(() => FakeRecognition.last.hear("it took a while to settle in"));
    act(() => vi.advanceTimersByTime(SILENCE_MS));
    expect(onFinish).toHaveBeenCalledWith("it took a while to settle in");
    expect(result.current.status).toBe("done");
    expect(FakeRecognition.last.stopped).toBe(true);
  });

  it("stop() finishes early with what was heard", () => {
    const onFinish = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition());
    act(() => result.current.start(onFinish));
    act(() => FakeRecognition.last.hear("go home"));
    act(() => result.current.stop());
    expect(onFinish).toHaveBeenCalledWith("go home");
  });

  it("reports no speech when nothing is heard", () => {
    const onFinish = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition());
    act(() => result.current.start(onFinish));
    act(() => vi.advanceTimersByTime(NO_SPEECH_MS));
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("noSpeech");
    expect(onFinish).not.toHaveBeenCalled();
  });

  it.each([
    ["not-allowed", "permissionDenied"],
    ["service-not-allowed", "permissionDenied"],
    ["audio-capture", "noMicrophone"],
    ["network", "network"],
    ["no-speech", "noSpeech"],
    ["something-else", "failed"],
  ])("maps the %s error to %s", (code, expected) => {
    const { result } = renderHook(() => useSpeechRecognition());
    act(() => result.current.start(() => {}));
    act(() => FakeRecognition.last.onerror?.({ error: code }));
    expect(result.current.error).toBe(expected);
    expect(result.current.status).toBe("error");
  });

  it("keeps what was heard if the browser ends on its own", () => {
    const onFinish = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition());
    act(() => result.current.start(onFinish));
    act(() => FakeRecognition.last.hear("we moved"));
    act(() => FakeRecognition.last.onend?.());
    expect(onFinish).toHaveBeenCalledWith("we moved");
  });

  it("reports unsupported browsers instead of throwing", () => {
    delete (window as unknown as { webkitSpeechRecognition?: unknown })
      .webkitSpeechRecognition;
    const { result } = renderHook(() => useSpeechRecognition());
    expect(result.current.availability).toBe("unsupported");
    act(() => result.current.start(() => {}));
    expect(result.current.error).toBe("unsupported");
  });

  it("treats Brave as unavailable without trying to listen", () => {
    Object.defineProperty(navigator, "brave", {
      value: {},
      configurable: true,
    });
    const { result } = renderHook(() => useSpeechRecognition());
    expect(result.current.availability).toBe("brave");

    const before = FakeRecognition.last;
    act(() => result.current.start(() => {}));
    expect(FakeRecognition.last).toBe(before);
    expect(result.current.error).toBe("brave");
  });

  it("gives up after network errors in a row", () => {
    expect(NETWORK_RETRY_LIMIT).toBe(2);
    const { result } = renderHook(() => useSpeechRecognition());
    act(() => result.current.start(() => {}));
    act(() => FakeRecognition.last.onerror?.({ error: "network" }));
    expect(result.current.error).toBe("network");

    // Starting over (e.g. a retry run) doesn't clear the count.
    act(() => result.current.reset());
    act(() => result.current.start(() => {}));
    act(() => FakeRecognition.last.onerror?.({ error: "network" }));
    expect(result.current.error).toBe("unavailable");
  });

  it("starts counting network errors again after a successful attempt", () => {
    const { result } = renderHook(() => useSpeechRecognition());
    act(() => result.current.start(() => {}));
    act(() => FakeRecognition.last.onerror?.({ error: "network" }));

    act(() => result.current.start(() => {}));
    act(() => FakeRecognition.last.hear("go home"));
    act(() => vi.advanceTimersByTime(SILENCE_MS));

    act(() => result.current.start(() => {}));
    act(() => FakeRecognition.last.onerror?.({ error: "network" }));
    expect(result.current.error).toBe("network");
  });

  it("starts counting network errors again after a different error", () => {
    const { result } = renderHook(() => useSpeechRecognition());
    act(() => result.current.start(() => {}));
    act(() => FakeRecognition.last.onerror?.({ error: "network" }));

    act(() => result.current.start(() => {}));
    act(() => vi.advanceTimersByTime(NO_SPEECH_MS));
    expect(result.current.error).toBe("noSpeech");

    act(() => result.current.start(() => {}));
    act(() => FakeRecognition.last.onerror?.({ error: "network" }));
    expect(result.current.error).toBe("network");
  });

  it("aborts listening on unmount", () => {
    const { result, unmount } = renderHook(() => useSpeechRecognition());
    act(() => result.current.start(() => {}));
    const recognition = FakeRecognition.last;
    unmount();
    expect(recognition.aborted).toBe(true);
  });
});

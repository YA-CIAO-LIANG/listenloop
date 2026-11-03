import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoicePicker } from "@/components/VoicePicker";
import { renderWithIntl } from "../render";

class FakeAudio extends EventTarget {
  static last: FakeAudio;
  src = "";
  currentTime = 0;
  paused = true;
  constructor() {
    super();
    FakeAudio.last = this;
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

beforeEach(() => vi.stubGlobal("Audio", FakeAudio));
afterEach(() => vi.unstubAllGlobals());

const sampleUrl = (id: string) => `/voices/${id}.mp3`;

function renderPicker(
  onChange = vi.fn(),
  urls: (id: string) => string | null = sampleUrl,
) {
  renderWithIntl(
    <VoicePicker value="us-female" onChange={onChange} sampleUrl={urls} />,
  );
  return onChange;
}

describe("VoicePicker", () => {
  it("shows eight voices in four accent groups, with the chosen one checked", () => {
    renderPicker();
    expect(screen.getAllByRole("radio")).toHaveLength(8);
    for (const accent of ["美式英語", "英式英語", "澳洲英語", "印度英語"]) {
      expect(screen.getByRole("group", { name: accent })).toBeTruthy();
    }
    expect(
      (
        screen.getByRole("radio", {
          name: "美式英語・女聲",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
  });

  it("chooses a voice by its card", () => {
    const onChange = renderPicker();
    fireEvent.click(screen.getByRole("radio", { name: "澳洲英語・男聲" }));
    expect(onChange).toHaveBeenCalledWith("au-male");
  });

  it("plays one sample at a time and stops on a second press", async () => {
    renderPicker();
    const listenGb = screen.getByRole("button", { name: "試聽英式英語・女聲" });
    await act(async () => fireEvent.click(listenGb));
    expect(FakeAudio.last.src).toBe("/voices/gb-female.mp3");
    expect(listenGb.textContent).toBe("播放中…");
    expect(listenGb.getAttribute("aria-pressed")).toBe("true");

    // Another card's sample replaces it.
    await act(async () =>
      fireEvent.click(
        screen.getByRole("button", { name: "試聽印度英語・男聲" }),
      ),
    );
    expect(FakeAudio.last.src).toBe("/voices/in-male.mp3");
    expect(listenGb.textContent).toBe("試聽");

    const stop = screen.getByRole("button", { name: "停止試聽印度英語・男聲" });
    await act(async () => fireEvent.click(stop));
    expect(FakeAudio.last.paused).toBe(true);
    expect(stop.textContent).toBe("試聽");
  });

  it("goes back to Listen when the sample ends", async () => {
    renderPicker();
    const listen = screen.getByRole("button", { name: "試聽美式英語・男聲" });
    await act(async () => fireEvent.click(listen));
    await act(async () => {
      FakeAudio.last.dispatchEvent(new Event("ended"));
    });
    expect(listen.textContent).toBe("試聽");
  });

  it("can't play a voice without a sample", () => {
    renderPicker(vi.fn(), () => null);
    expect(
      (
        screen.getByRole("button", {
          name: "試聽美式英語・女聲",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});

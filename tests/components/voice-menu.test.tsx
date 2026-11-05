import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceMenu } from "@/components/VoiceMenu";
import { voiceDisplayName } from "@/lib/ai/voices";
import { renderWithIntl } from "../render";

class FakeAudio extends EventTarget {
  src = "";
  currentTime = 0;
  play() {
    return Promise.resolve();
  }
  pause() {}
}

beforeEach(() => vi.stubGlobal("Audio", FakeAudio));
afterEach(() => vi.unstubAllGlobals());

const sampleUrl = (id: string) => `/voices/${id}.mp3`;

function renderMenu(onChange = vi.fn()) {
  renderWithIntl(
    <VoiceMenu value="us-female" onChange={onChange} sampleUrl={sampleUrl} />,
  );
  return onChange;
}

const menuButton = () => screen.getByRole("button", { name: /^聲音：/ });

describe("voiceDisplayName", () => {
  it("is the speaker's name from the Google voice", () => {
    expect(voiceDisplayName("us-female")).toBe("Kore");
    expect(voiceDisplayName("in-male")).toBe("Charon");
    expect(voiceDisplayName("xx-female")).toBeNull();
  });
});

describe("VoiceMenu", () => {
  it("shows the chosen voice and opens grouped by accent", () => {
    renderMenu();
    expect(menuButton().textContent).toBe("Kore · 女聲 · 美式英語");
    expect(menuButton().getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(menuButton());
    expect(menuButton().getAttribute("aria-expanded")).toBe("true");
    // The fieldset, then one group per accent.
    expect(screen.getAllByRole("group")).toHaveLength(5);
    expect(screen.getByRole("group", { name: "英式英語" })).toBeTruthy();
    expect(screen.getByText("r 常不發音，語調起伏較大。")).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(8);
    // Focus lands on the chosen voice.
    expect(document.activeElement).toBe(
      screen.getByRole("radio", { name: "Kore・女聲・美式英語" }),
    );
  });

  it("chooses a voice with a click and closes", () => {
    const onChange = renderMenu();
    fireEvent.click(menuButton());
    const radio = screen.getByRole("radio", { name: "Charon・男聲・英式英語" });
    fireEvent.click(radio, { detail: 1 });
    expect(onChange).toHaveBeenCalledWith("gb-male");
    expect(menuButton().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(menuButton());
  });

  it("stays open while arrow keys move between voices; Enter chooses", () => {
    const onChange = renderMenu();
    fireEvent.click(menuButton());
    const radio = screen.getByRole("radio", { name: "Kore・女聲・澳洲英語" });
    // Arrow keys check the next radio with a click of detail 0.
    fireEvent.click(radio, { detail: 0 });
    expect(onChange).toHaveBeenCalledWith("au-female");
    expect(menuButton().getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(radio, { key: "Enter" });
    expect(menuButton().getAttribute("aria-expanded")).toBe("false");
  });

  it("closes on Escape and on a press outside", () => {
    renderMenu();
    fireEvent.click(menuButton());
    fireEvent.keyDown(screen.getAllByRole("radio")[0], { key: "Escape" });
    expect(menuButton().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(menuButton());

    fireEvent.click(menuButton());
    act(() => {
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(menuButton().getAttribute("aria-expanded")).toBe("false");
  });

  it("plays one sample at a time without choosing that voice", async () => {
    const onChange = renderMenu();
    fireEvent.click(menuButton());
    const listen = screen.getByRole("button", {
      name: "試聽Charon・男聲・印度英語",
    });
    await act(async () => fireEvent.click(listen));
    expect(listen.getAttribute("aria-pressed")).toBe("true");
    expect(
      screen.getByRole("button", { name: "停止試聽Charon・男聲・印度英語" }),
    ).toBe(listen);
    expect(onChange).not.toHaveBeenCalled();
    expect(menuButton().getAttribute("aria-expanded")).toBe("true");
  });
});

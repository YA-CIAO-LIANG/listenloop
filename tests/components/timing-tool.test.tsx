import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TimingTool } from "@/app/videos/[id]/timing/TimingTool";
import { videos } from "@/data/videos";
import { renderWithIntl } from "../render";

const playSegment = vi.hoisted(() => vi.fn());
const playFrom = vi.hoisted(() => vi.fn());
const stop = vi.hoisted(() => vi.fn());
/** The video's current time, as the tap-mode tests move it along. */
const clock = vi.hoisted(() => ({ now: 0 }));
vi.mock("@/components/youtube/useYouTubePlayer", () => ({
  useYouTubePlayer: () => ({
    containerRef: () => {},
    status: "ready",
    error: null,
    isPlaying: false,
    playSegment,
    playFrom,
    currentTime: () => clock.now,
    stop,
  }),
}));

const sintel = videos.find((v) => v.id === "sintel")!;
const count = sintel.sentences.length;
const exported = () =>
  JSON.parse((screen.getByRole("textbox") as HTMLTextAreaElement).value);

describe("TimingTool", () => {
  it("plays a sentence with padding and shows the played range", async () => {
    renderWithIntl(<TimingTool video={sintel} />);
    const rows = screen.getAllByRole("listitem");
    await userEvent.click(
      within(rows[0]).getByRole("button", { name: "播放" }),
    );
    expect(playSegment).toHaveBeenLastCalledWith(107.1, 110.75);
    expect(within(rows[0]).getByText("實際播放 107.10–110.75")).toBeDefined();
  });

  it("nudges times by 0.1 s without float drift and exports the JSON", async () => {
    renderWithIntl(<TimingTool video={sintel} />);
    const later = within(screen.getAllByRole("listitem")[0]).getByRole(
      "button",
      { name: "結束 延後 0.1 秒" },
    );
    for (let n = 0; n < 3; n++) await userEvent.click(later);
    expect(exported()[0].end).toBe(110.8);
    // 110.8 + 0.25 padding, still before sentence 2 starts at 111.8.
    expect(
      within(screen.getAllByRole("listitem")[0]).getByText(
        "實際播放 107.10–111.05",
      ),
    ).toBeDefined();
    expect(exported()[0].en).toBe("This blade has a dark past.");
    expect(screen.getByText("時間點格式正確。")).toBeDefined();
  });

  it("warns when a sentence starts before the previous one ends", async () => {
    renderWithIntl(<TimingTool video={sintel} />);
    // Sentence 5 starts at 125.25; sentence 4 ends at 124.8.
    const earlier = within(screen.getAllByRole("listitem")[4]).getByRole(
      "button",
      { name: "開始 提早 0.1 秒" },
    );
    for (let n = 0; n < 5; n++) await userEvent.click(earlier);
    expect(screen.getByRole("alert").textContent).toContain(
      "sentences[4].start must not be before the previous end",
    );

    await userEvent.click(screen.getByRole("button", { name: "還原" }));
    expect(exported()[4].start).toBe(125.25);
  });

  it("copies the sentences JSON to the clipboard", async () => {
    const user = userEvent.setup();
    renderWithIntl(<TimingTool video={sintel} />);
    await user.click(screen.getByRole("button", { name: "複製 JSON" }));
    expect(JSON.parse(await navigator.clipboard.readText())).toEqual(
      sintel.sentences,
    );
    expect(screen.getByText("已複製！")).toBeDefined();
  });
});

describe("TimingTool tap mode", () => {
  const press = (key: string) =>
    act(() => {
      fireEvent.keyDown(window, { key, code: key === " " ? "Space" : key });
    });

  it("marks each sentence start with Space and the last end with Enter", async () => {
    renderWithIntl(<TimingTool video={sintel} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "從第幾秒開始" }), {
      target: { value: "105" },
    });
    await userEvent.click(screen.getByRole("button", { name: "開始點按" }));
    expect(playFrom).toHaveBeenLastCalledWith(105);
    expect(
      screen.getByText(new RegExp(`下一句（1 / ${count}）`)),
    ).toBeDefined();

    // One tap every 5 s, so the tapped excerpt runs over the 1-minute minimum.
    const last = count - 1;
    sintel.sentences.forEach((_, i) => {
      clock.now = 107 + i * 5;
      press(" ");
    });
    expect(screen.getByText(/全部標完了/)).toBeDefined();
    clock.now = 107 + last * 5 + 4.7;
    press("Enter");

    expect(stop).toHaveBeenCalled();
    expect(screen.getByText(new RegExp(`已標記 ${count} 句`))).toBeDefined();
    const times = exported();
    expect(times[0]).toMatchObject({ start: 107, end: 111.9 });
    expect(times[1]).toMatchObject({ start: 112, end: 116.9 });
    expect(times[last]).toMatchObject({
      start: 107 + last * 5,
      end: 107 + last * 5 + 4.7,
    });
    expect(screen.getByText("時間點格式正確。")).toBeDefined();
  });

  it("takes back the last tap and replays from just before it", async () => {
    renderWithIntl(<TimingTool video={sintel} />);
    await userEvent.click(screen.getByRole("button", { name: "開始點按" }));
    clock.now = 107;
    press(" ");
    clock.now = 111;
    press(" ");
    expect(
      screen.getByText(new RegExp(`下一句（3 / ${count}）`)),
    ).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "上一句重來" }));
    expect(
      screen.getByText(new RegExp(`下一句（2 / ${count}）`)),
    ).toBeDefined();
    expect(playFrom).toHaveBeenLastCalledWith(106);
  });

  it("cancels without changing any time", async () => {
    renderWithIntl(<TimingTool video={sintel} />);
    const before = exported();
    await userEvent.click(screen.getByRole("button", { name: "開始點按" }));
    clock.now = 50;
    press(" ");
    await userEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(exported()).toEqual(before);
    expect(screen.getByRole("button", { name: "開始點按" })).toBeDefined();
  });
});

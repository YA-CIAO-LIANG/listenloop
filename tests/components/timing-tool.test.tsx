import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TimingTool } from "@/app/videos/[id]/timing/TimingTool";
import { videos } from "@/data/videos";
import { renderWithIntl } from "../render";

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

const sintel = videos.find((v) => v.id === "sintel")!;
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

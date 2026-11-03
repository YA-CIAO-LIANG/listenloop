import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PracticeAudioStatus } from "@/components/PracticeAudioStatus";
import { renderWithIntl } from "../render";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/materials/actions", () => ({ generatePracticeAudio: vi.fn() }));

const generate = vi.fn();
beforeEach(() => {
  router.refresh.mockReset();
  generate.mockReset();
});

describe("PracticeAudioStatus", () => {
  it("says the audio is ready", () => {
    renderWithIntl(
      <PracticeAudioStatus
        practiceId="p1"
        practiceHref="/videos/p-1"
        voiced={4}
        total={4}
        generate={generate}
      />,
    );
    expect(screen.getByText("音檔已完成")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "開始練習" }).getAttribute("href"),
    ).toBe("/videos/p-1");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("continues generating unfinished audio", async () => {
    generate.mockResolvedValue({ ok: true, voiced: 10, total: 10 });
    renderWithIntl(
      <PracticeAudioStatus
        practiceId="p1"
        practiceHref="/videos/p-1"
        voiced={3}
        total={10}
        generate={generate}
      />,
    );
    expect(screen.getByText("音檔 3 / 10")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "繼續產生音檔" }));
    });
    expect(generate).toHaveBeenCalledWith("p1");
    expect(screen.getByText("音檔已完成")).toBeTruthy();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("explains why it stopped and shows how far it got", async () => {
    generate.mockResolvedValue({
      ok: false,
      reason: "limit",
      voiced: 5,
      total: 10,
    });
    renderWithIntl(
      <PracticeAudioStatus
        practiceId="p1"
        practiceHref="/videos/p-1"
        voiced={3}
        total={10}
        generate={generate}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "繼續產生音檔" }));
    });
    expect(screen.getByText("音檔 5 / 10")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("今天的聲音用量");
  });
});

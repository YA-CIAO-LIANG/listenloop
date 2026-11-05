import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PracticeReadiness } from "@/components/PracticeReadiness";
import { renderWithIntl } from "../render";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/materials/actions", () => ({}));

const generate = vi.fn();
const generateNotes = vi.fn();
beforeEach(() => {
  router.refresh.mockReset();
  generate.mockReset();
  generateNotes
    .mockReset()
    .mockResolvedValue({ ok: true, annotated: 10, total: 10 });
});

function renderReadiness(props: {
  notesReady: boolean;
  voiced: number;
  total: number;
}) {
  renderWithIntl(
    <PracticeReadiness
      practiceId="p1"
      practiceHref="/videos/p-1"
      generate={generate}
      generateNotes={generateNotes}
      {...props}
    />,
  );
}

const resume = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "繼續產生" }));
  });
};

describe("PracticeReadiness", () => {
  it("offers practice once notes and audio are ready", () => {
    renderReadiness({ notesReady: true, voiced: 4, total: 4 });
    expect(screen.getByText("講解和音檔都完成了")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "開始練習" }).getAttribute("href"),
    ).toBe("/videos/p-1");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("isn't ready while the notes are missing, even with all the audio", () => {
    renderReadiness({ notesReady: false, voiced: 4, total: 4 });
    expect(screen.getByText("講解還沒產生・音檔 4 / 4")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "開始練習" })).toBeNull();
  });

  it("makes the notes first, then the rest of the audio", async () => {
    generate.mockResolvedValue({ ok: true, voiced: 10, total: 10 });
    renderReadiness({ notesReady: false, voiced: 3, total: 10 });
    await resume();
    expect(generateNotes).toHaveBeenCalledWith("p1");
    expect(generate).toHaveBeenCalledWith("p1");
    expect(generateNotes.mock.invocationCallOrder[0]).toBeLessThan(
      generate.mock.invocationCallOrder[0],
    );
    expect(screen.getByText("講解和音檔都完成了")).toBeTruthy();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("skips the notes when they're already made", async () => {
    generate.mockResolvedValue({ ok: true, voiced: 10, total: 10 });
    renderReadiness({ notesReady: true, voiced: 3, total: 10 });
    await resume();
    expect(generateNotes).not.toHaveBeenCalled();
  });

  it("stops before the audio when the notes fail, and says why", async () => {
    generateNotes.mockResolvedValue({ ok: false, reason: "busy" });
    renderReadiness({ notesReady: false, voiced: 0, total: 10 });
    await resume();
    expect(generate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain(
      "AI 服務目前忙碌中",
    );
  });

  it("shows how far the audio got when it stops", async () => {
    generate.mockResolvedValue({
      ok: false,
      reason: "limit",
      voiced: 5,
      total: 10,
    });
    renderReadiness({ notesReady: true, voiced: 3, total: 10 });
    await resume();
    expect(screen.getByText("講解已完成・音檔 5 / 10")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("今天的聲音用量");
  });
});

import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditPracticeForm } from "@/components/EditPracticeForm";
import { renderWithIntl } from "../render";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
// The real Server Actions can't run in a test DOM; the form takes them as props.
vi.mock("@/app/materials/actions", () => ({
  generatePracticeAudio: vi.fn(),
  generatePracticeNotes: vi.fn(),
}));
vi.mock("@/app/materials/edit-actions", () => ({ savePracticeEdit: vi.fn() }));

const notes = {
  vocab: [{ word: "home", pos: "n.", zh: "家", example: "I'm home." }],
  grammar: [],
};
const practice = {
  id: "p1",
  title: "第一課",
  voice: "us-female",
  version: 2,
  sentences: [
    { en: "Go home.", zh: "回家。", notes },
    { en: "We moved.", zh: "我們搬家了。", notes: { vocab: [], grammar: [] } },
  ],
};
const save = vi.fn();
const generate = vi.fn();
const generateNotes = vi.fn();

function renderForm() {
  renderWithIntl(
    <EditPracticeForm
      practice={practice}
      save={save}
      generate={generate}
      generateNotes={generateNotes}
    />,
  );
}

const field = (name: string) => screen.getByRole("textbox", { name });
const click = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
};

beforeEach(() => {
  router.refresh.mockReset();
  save.mockReset().mockResolvedValue({
    ok: true,
    version: 3,
    notesReady: false,
    total: 2,
  });
  generateNotes
    .mockReset()
    .mockResolvedValue({ ok: true, annotated: 2, total: 2 });
  generate.mockReset().mockResolvedValue({ ok: true, voiced: 2, total: 2 });
});

describe("EditPracticeForm", () => {
  it("saves a reordered, edited practice and makes only what's missing", async () => {
    renderForm();
    fireEvent.change(field("第 1 句英文"), {
      target: { value: "Go home now." },
    });
    expect(screen.getByText(/英文改過了/)).toBeDefined();
    await click("第 2 句上移");
    await click("儲存");

    expect(save).toHaveBeenCalledWith("p1", {
      expectedVersion: 2,
      title: "第一課",
      voice: "us-female",
      sentences: [
        {
          en: "We moved.",
          zh: "我們搬家了。",
          notes: { vocab: [], grammar: [] },
        },
        { en: "Go home now.", zh: "", notes: null },
      ],
    });
    expect(generateNotes).toHaveBeenCalledWith("p1");
    expect(generate).toHaveBeenCalledWith("p1");
    expect(screen.getByRole("status").textContent).toContain("已儲存新版本");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("sends notes the author wrote by hand", async () => {
    renderForm();
    fireEvent.change(field("第 1 句單字 1 的中文"), {
      target: { value: "家；住處" },
    });
    await click("儲存");
    expect(save.mock.calls[0][1].sentences[0].notes).toEqual({
      vocab: [{ ...notes.vocab[0], zh: "家；住處" }],
      grammar: [],
    });
  });

  it("explains a conflict", async () => {
    save.mockResolvedValue({ ok: false, reason: "conflict" });
    renderForm();
    await click("儲存");
    expect(screen.getByRole("alert").textContent).toContain("重新整理");
    expect(generate).not.toHaveBeenCalled();
  });

  it("names the sentence with a problem", async () => {
    save.mockResolvedValue({
      ok: false,
      reason: "invalid",
      problem: "notes",
      sentence: 1,
    });
    renderForm();
    await click("儲存");
    expect(screen.getByRole("alert").textContent).toContain("第 2 句的講解");
  });
});

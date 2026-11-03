import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  AddEntryForm,
  DeleteEntryButton,
  NewNotebookForm,
  NotebookSettings,
} from "@/components/NotebookControls";
import { renderWithIntl } from "../render";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/notebooks/actions", () => ({}));
vi.mock("@/app/create/actions", () => ({}));

const ok = () => vi.fn(async () => ({ ok: true as const }));
const click = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
};

describe("notebooks", () => {
  it("creates a notebook", async () => {
    const createNotebook = ok();
    renderWithIntl(<NewNotebookForm createNotebook={createNotebook} />);
    fireEvent.change(screen.getByLabelText("新的筆記本名稱"), {
      target: { value: "生詞" },
    });
    await click("新增");
    expect(createNotebook).toHaveBeenCalledWith("生詞");
  });

  it("adds an entry with a note and clears the form", async () => {
    const addEntry = ok();
    renderWithIntl(<AddEntryForm notebookId="n1" addEntry={addEntry} />);
    const text = screen.getByLabelText("單字或句子") as HTMLInputElement;
    expect(text.getAttribute("lang")).toBe("en");
    fireEvent.change(text, { target: { value: "move to" } });
    fireEvent.change(screen.getByLabelText("筆記（選填）"), {
      target: { value: "搬到" },
    });
    await click("加入筆記本");
    expect(addEntry).toHaveBeenCalledWith("n1", "move to", "搬到");
    expect(text.value).toBe("");
  });

  it("keeps the entry and explains when saving fails", async () => {
    const addEntry = vi.fn(async () => ({
      ok: false as const,
      reason: "failed" as const,
    }));
    renderWithIntl(<AddEntryForm notebookId="n1" addEntry={addEntry} />);
    fireEvent.change(screen.getByLabelText("單字或句子"), {
      target: { value: "move to" },
    });
    await click("加入筆記本");
    expect(screen.getByRole("alert").textContent).toBe(
      "儲存失敗，請稍後再試一次。",
    );
    expect(
      (screen.getByLabelText("單字或句子") as HTMLInputElement).value,
    ).toBe("move to");
  });

  it("deletes an entry", async () => {
    const deleteEntry = ok();
    renderWithIntl(
      <DeleteEntryButton
        entry={{ id: "e1", text: "move to" }}
        deleteEntry={deleteEntry}
      />,
    );
    await click("刪除「move to」");
    expect(deleteEntry).toHaveBeenCalledWith("e1");
  });

  it("renames, and deletes the notebook after confirming", async () => {
    const renameNotebook = ok();
    const deleteNotebook = ok();
    renderWithIntl(
      <NotebookSettings
        notebook={{ id: "n1", title: "生詞" }}
        renameNotebook={renameNotebook}
        deleteNotebook={deleteNotebook}
      />,
    );
    await click("重新命名");
    fireEvent.change(screen.getByLabelText("「生詞」的新名稱"), {
      target: { value: "片語" },
    });
    await click("儲存");
    expect(renameNotebook).toHaveBeenCalledWith("n1", "片語");

    await click("刪除筆記本…");
    await click("永久刪除筆記本");
    expect(deleteNotebook).toHaveBeenCalledWith("n1");
    expect(router.push).toHaveBeenCalledWith("/notebooks");
  });
});

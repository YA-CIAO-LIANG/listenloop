import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionManager } from "@/components/CollectionManager";
import { PracticeControls } from "@/components/PracticeControls";
import { VisibilityToggle } from "@/components/VisibilityToggle";
import { renderWithIntl } from "../render";

vi.mock("@/app/materials/organize-actions", () => ({
  createCollection: vi.fn(),
  renameCollection: vi.fn(),
  deleteCollection: vi.fn(),
  setVisibility: vi.fn(async () => ({ ok: true })),
  movePractice: vi.fn(),
  deletePractice: vi.fn(),
}));
// Server Actions can't run in a test DOM; components take them as props.
vi.mock("@/app/materials/actions", () => ({}));

const ok = () => vi.fn(async () => ({ ok: true as const }));
const click = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
};

describe("VisibilityToggle", () => {
  it("saves the new choice", async () => {
    const setVisibility = ok();
    renderWithIntl(
      <VisibilityToggle
        kind="practice"
        id="p1"
        name="第一課"
        visibility="private"
        setVisibility={setVisibility}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByLabelText("公開"));
    });
    expect(setVisibility).toHaveBeenCalledWith("practice", "p1", "public");
    expect((screen.getByLabelText("公開") as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it("puts the old choice back when saving fails", async () => {
    const setVisibility = vi.fn(async () => ({
      ok: false as const,
      reason: "failed" as const,
    }));
    renderWithIntl(
      <VisibilityToggle
        kind="collection"
        id="c1"
        name="Week 1"
        visibility="private"
        setVisibility={setVisibility}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByLabelText("公開"));
    });
    expect((screen.getByLabelText("私人") as HTMLInputElement).checked).toBe(
      true,
    );
    expect(screen.getByRole("alert").textContent).toBe(
      "儲存失敗，請稍後再試一次。",
    );
  });
});

describe("PracticeControls", () => {
  const practice = {
    id: "p1",
    title: "第一課",
    collectionId: null,
    visibility: "private" as const,
  };
  const collections = [{ id: "c1", title: "Week 1" }];

  it("moves a practice into a collection and back out", async () => {
    const movePractice = ok();
    renderWithIntl(
      <PracticeControls
        practice={practice}
        collections={collections}
        movePractice={movePractice}
        deletePractice={ok()}
      />,
    );
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Collection"), {
        target: { value: "c1" },
      });
    });
    expect(movePractice).toHaveBeenLastCalledWith("p1", "c1");
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Collection"), {
        target: { value: "" },
      });
    });
    expect(movePractice).toHaveBeenLastCalledWith("p1", null);
  });

  it("deletes only after confirming", async () => {
    const deletePractice = ok();
    renderWithIntl(
      <PracticeControls
        practice={practice}
        collections={collections}
        movePractice={ok()}
        deletePractice={deletePractice}
      />,
    );
    await click("刪除練習…");
    expect(screen.getByText(/要刪除「第一課」嗎/)).toBeTruthy();
    await click("取消");
    expect(deletePractice).not.toHaveBeenCalled();
    await click("刪除練習…");
    await click("永久刪除練習");
    expect(deletePractice).toHaveBeenCalledWith("p1");
  });
});

describe("CollectionManager", () => {
  const collections = [
    {
      id: "c1",
      title: "Week 1",
      visibility: "private" as const,
      practiceCount: 2,
    },
  ];

  beforeEach(() => vi.clearAllMocks());

  it("adds a collection and clears the field", async () => {
    const createCollection = ok();
    renderWithIntl(
      <CollectionManager
        collections={[]}
        createCollection={createCollection}
      />,
    );
    const field = screen.getByLabelText(
      "新的 Collection 名稱",
    ) as HTMLInputElement;
    fireEvent.change(field, { target: { value: "Week 2" } });
    await click("新增");
    expect(createCollection).toHaveBeenCalledWith("Week 2");
    expect(field.value).toBe("");
  });

  it("renames and deletes after confirming", async () => {
    const renameCollection = ok();
    const deleteCollection = ok();
    renderWithIntl(
      <CollectionManager
        collections={collections}
        renameCollection={renameCollection}
        deleteCollection={deleteCollection}
      />,
    );
    expect(screen.getByText("2 個練習")).toBeTruthy();
    await click("重新命名");
    fireEvent.change(screen.getByLabelText("「Week 1」的新名稱"), {
      target: { value: "Unit 1" },
    });
    await click("儲存");
    expect(renameCollection).toHaveBeenCalledWith("c1", "Unit 1");

    await click("刪除…");
    await click("刪除 Collection");
    expect(deleteCollection).toHaveBeenCalledWith("c1");
  });

  it("explains an invalid name", async () => {
    const createCollection = vi.fn(async () => ({
      ok: false as const,
      reason: "invalid" as const,
    }));
    renderWithIntl(
      <CollectionManager
        collections={[]}
        createCollection={createCollection}
      />,
    );
    fireEvent.change(screen.getByLabelText("新的 Collection 名稱"), {
      target: { value: "x" },
    });
    await click("新增");
    expect(screen.getByRole("alert").textContent).toContain("請填寫名稱");
  });
});

import { describe, expect, it } from "vitest";
import {
  categoryFolders,
  folderCounts,
  folderParam,
  materialsAt,
  parseFolderParam,
  parseMaterialsView,
} from "@/lib/material-folders";

/** "My materials" as folders (D147). */
const folders = [
  { id: "11111111-1111-4111-8111-111111111111", title: "Exam prep" },
];
const materials = [
  { id: "a", collectionId: folders[0].id, category: "travel" },
  { id: "b", collectionId: null, category: "travel" },
  { id: "c", collectionId: null, category: null },
  // Its folder was deleted elsewhere: it's at the top again.
  { id: "d", collectionId: "gone", category: "exam" },
];

describe("material folders", () => {
  it("reads and writes the place in the address, and ignores unknown ones", () => {
    const place = parseFolderParam(`f-${folders[0].id}`, folders);
    expect(place).toEqual({ kind: "folder", id: folders[0].id });
    expect(folderParam(place)).toBe(`f-${folders[0].id}`);
    expect(parseFolderParam("c-travel", folders)).toEqual({
      kind: "category",
      id: "travel",
    });
    for (const odd of ["f-nope", "c-nope", "x", null, undefined]) {
      expect(parseFolderParam(odd, folders)).toEqual({ kind: "root" });
    }
    expect(folderParam({ kind: "root" })).toBeNull();
  });

  it("shows a folder's materials, a category's, and the rest at the top", () => {
    const ids = (place: Parameters<typeof materialsAt>[1]) =>
      materialsAt(materials, place, folders).map((m) => m.id);
    expect(ids({ kind: "folder", id: folders[0].id })).toEqual(["a"]);
    expect(ids({ kind: "category", id: "travel" })).toEqual(["a", "b"]);
    expect(ids({ kind: "root" })).toEqual(["b", "c", "d"]);
  });

  it("lists the categories in use in the library's order, with counts", () => {
    expect(categoryFolders(materials)).toEqual([
      { id: "travel", count: 2 },
      { id: "exam", count: 1 },
    ]);
    expect(folderCounts(materials).get(folders[0].id)).toBe(1);
  });

  it("remembers grid or list, grid by default", () => {
    expect(parseMaterialsView("list")).toBe("list");
    expect(parseMaterialsView("other")).toBe("grid");
  });
});

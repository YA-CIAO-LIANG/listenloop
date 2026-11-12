import { CATEGORY_IDS, type CategoryId } from "./categories";

/**
 * "My materials" as folders (D147): the learner's own folders (their
 * collections, which they create, rename, delete, and move materials
 * into) and a folder for each category their materials are in (made by
 * themselves, read-only). A material with a category of its own (D82)
 * goes into a folder of that name when it's made, so that's a folder too.
 */
export type FolderMaterial = {
  id: string;
  collectionId: string | null;
  category: string | null;
};

export type OwnFolder = { id: string; title: string };

/** Where the page is: the top, one of my folders, or a category. */
export type FolderPlace =
  | { kind: "root" }
  | { kind: "folder"; id: string }
  | { kind: "category"; id: CategoryId };

/** ?folder= in the address: "f-<uuid>" or "c-<category id>". */
export function parseFolderParam(
  value: string | null | undefined,
  folders: readonly OwnFolder[],
): FolderPlace {
  if (value?.startsWith("f-")) {
    const id = value.slice(2);
    if (folders.some((folder) => folder.id === id))
      return { kind: "folder", id };
  }
  if (value?.startsWith("c-")) {
    const id = value.slice(2);
    if ((CATEGORY_IDS as readonly string[]).includes(id)) {
      return { kind: "category", id: id as CategoryId };
    }
  }
  return { kind: "root" };
}

export function folderParam(place: FolderPlace): string | null {
  return place.kind === "folder"
    ? `f-${place.id}`
    : place.kind === "category"
      ? `c-${place.id}`
      : null;
}

/** The materials shown at a place. The top shows those in no folder. */
export function materialsAt<T extends FolderMaterial>(
  materials: readonly T[],
  place: FolderPlace,
  folders: readonly OwnFolder[],
): T[] {
  const ids = new Set(folders.map((folder) => folder.id));
  return materials.filter((material) =>
    place.kind === "folder"
      ? material.collectionId === place.id
      : place.kind === "category"
        ? material.category === place.id
        : material.collectionId === null || !ids.has(material.collectionId),
  );
}

/** The category folders: categories in use, in the library's order. */
export function categoryFolders(
  materials: readonly FolderMaterial[],
): { id: CategoryId; count: number }[] {
  return CATEGORY_IDS.flatMap((id) => {
    const count = materials.filter((m) => m.category === id).length;
    return count > 0 ? [{ id, count }] : [];
  });
}

/** How many materials are in each of my folders. */
export function folderCounts(
  materials: readonly FolderMaterial[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const material of materials) {
    if (material.collectionId) {
      counts.set(
        material.collectionId,
        (counts.get(material.collectionId) ?? 0) + 1,
      );
    }
  }
  return counts;
}

/** Grid or list; remembered per account (D138). */
export const MATERIALS_VIEW_KEY = "ll-materials-view:v1";
export type MaterialsView = "grid" | "list";
export const parseMaterialsView = (value: unknown): MaterialsView =>
  value === "list" ? "list" : "grid";

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  createCollection as createCollectionAction,
  deleteCollection as deleteCollectionAction,
  movePractice as movePracticeAction,
  renameCollection as renameCollectionAction,
} from "@/app/materials/organize-actions";
import { lastDoneDay } from "@/lib/cycle";
import { COLLECTION_TITLE_MAX } from "@/lib/custom-practice/organize";
import {
  categoryFolders,
  folderCounts,
  folderParam,
  materialsAt,
  MATERIALS_VIEW_KEY,
  parseFolderParam,
  parseMaterialsView,
  type MaterialsView,
} from "@/lib/material-folders";
import { settingsChanged } from "@/lib/personal-settings";
import type { Progress } from "@/lib/progress";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";
import { MaterialTitle } from "./MaterialTitle";
import { SegmentedControl } from "./SegmentedControl";
import { useStores } from "./StoresProvider";
import { useOrganizeAction } from "./useOrganizeAction";

export type BrowserFolder = { id: string; title: string };

export type BrowserMaterial = {
  id: string;
  /** Its practice id ("p-<uuid>"), for its pages and progress. */
  videoId: string;
  titles: { en: string; zh: string | null };
  subtitle: string | null;
  /** Its audio's length, or the estimate; null if unknown. */
  seconds: number | null;
  collectionId: string | null;
  category: string | null;
  /** Edit, public or private, readiness, delete: rendered by the page. */
  details: ReactNode;
};

/** What a dragged material carries, so folders know to accept it. */
const DRAG_TYPE = "application/x-listenloop-material";

const fieldClassName =
  "h-11 w-full max-w-xs rounded-base border border-line bg-surface px-3 focus-visible:border-accent";

const viewListeners = new Set<() => void>();
function readView(): MaterialsView {
  try {
    return parseMaterialsView(localStorage.getItem(MATERIALS_VIEW_KEY));
  } catch {
    return "grid";
  }
}

/**
 * "My materials" as folders (D147): my folders and the categories at the
 * top, a folder's materials inside it, with a breadcrumb back. Each
 * material moves by dragging it onto a folder (mouse) or with "Move to"
 * (any device, and the keyboard). Grid or list, remembered.
 */
export function MaterialsBrowser({
  folders,
  materials,
  canCreate,
  createCollection = createCollectionAction,
  renameCollection = renameCollectionAction,
  deleteCollection = deleteCollectionAction,
  movePractice = movePracticeAction,
}: {
  folders: BrowserFolder[];
  materials: BrowserMaterial[];
  canCreate: boolean;
  /** Injected in tests; the Server Actions otherwise. */
  createCollection?: typeof createCollectionAction;
  renameCollection?: typeof renameCollectionAction;
  deleteCollection?: typeof deleteCollectionAction;
  movePractice?: typeof movePracticeAction;
}) {
  const t = useTranslations("materials.folders");
  const tCategories = useTranslations("categories.names");
  const place = parseFolderParam(useSearchParams().get("folder"), folders);
  const view = useSyncExternalStore(
    (listener) => {
      viewListeners.add(listener);
      return () => viewListeners.delete(listener);
    },
    readView,
    () => "grid" as MaterialsView,
  );
  const setView = (next: MaterialsView) => {
    try {
      localStorage.setItem(MATERIALS_VIEW_KEY, next);
    } catch {
      // Not remembered; it still switches until the page reloads.
    }
    settingsChanged();
    viewListeners.forEach((listener) => listener());
  };
  const progress = useProgresses();
  const move = useOrganizeAction();
  const [dragging, setDragging] = useState<string | null>(null);

  const counts = folderCounts(materials);
  const shown = materialsAt(materials, place, folders);
  const folder =
    place.kind === "folder"
      ? folders.find((f) => f.id === place.id)
      : undefined;
  const placeName =
    place.kind === "folder"
      ? (folder?.title ?? "")
      : place.kind === "category"
        ? tCategories(place.id)
        : null;

  const moveTo = (materialId: string, collectionId: string | null) =>
    move.run(() => movePractice(materialId, collectionId));

  // Dropping a dragged material onto a folder (or the top) moves it.
  const dropTarget = (collectionId: string | null) => ({
    onDragOver: (event: DragEvent) => {
      if (event.dataTransfer.types.includes(DRAG_TYPE)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }
    },
    onDrop: (event: DragEvent) => {
      const id = event.dataTransfer.getData(DRAG_TYPE);
      if (!id) return;
      event.preventDefault();
      setDragging(null);
      void moveTo(id, collectionId);
    },
  });

  return (
    <div className="space-y-8">
      <nav aria-label={t("breadcrumb")}>
        <ol className="flex flex-wrap items-center gap-2 text-supporting">
          <li {...dropTarget(null)}>
            {placeName === null ? (
              <span aria-current="page" className="font-medium">
                {t("root")}
              </span>
            ) : (
              <Link
                href="/materials"
                className="tap text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink"
              >
                {t("root")}
              </Link>
            )}
          </li>
          {placeName !== null && (
            <>
              <li aria-hidden="true" className="text-ink-muted">
                ›
              </li>
              <li aria-current="page" className="font-medium">
                {placeName}
              </li>
            </>
          )}
        </ol>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <SegmentedControl
          legend={t("viewLegend")}
          value={view}
          options={[
            { value: "grid", label: t("grid") },
            { value: "list", label: t("list") },
          ]}
          onChange={setView}
          optionWidthClassName="min-w-16"
        />
        {canCreate && (
          <ButtonLink href="/materials/new" variant="primary" arrow>
            {t("create")}
          </ButtonLink>
        )}
      </div>

      {move.error && (
        <p role="alert" className="text-supporting text-error">
          {t("moveFailed")}
        </p>
      )}

      {place.kind === "root" && (
        <>
          <section aria-labelledby="my-folders" className="space-y-4">
            <h2 id="my-folders" className="font-display text-h3">
              {t("myFolders")}
            </h2>
            <ul className={tilesClass(view)}>
              {folders.map((f) => (
                <li key={f.id} {...dropTarget(f.id)}>
                  <FolderTile
                    href={`/materials?folder=${folderParam({ kind: "folder", id: f.id })}`}
                    name={f.title}
                    count={counts.get(f.id) ?? 0}
                    highlight={dragging !== null}
                  />
                </li>
              ))}
            </ul>
            <NewFolder create={createCollection} />
          </section>
          {categoryFolders(materials).length > 0 && (
            <section aria-labelledby="by-category" className="space-y-4">
              <h2 id="by-category" className="font-display text-h3">
                {t("byCategory")}
              </h2>
              <p className="text-supporting text-ink-muted">
                {t("byCategoryNote")}
              </p>
              <ul className={tilesClass(view)}>
                {categoryFolders(materials).map(({ id, count }) => (
                  <li key={id}>
                    <FolderTile
                      href={`/materials?folder=${folderParam({ kind: "category", id })}`}
                      name={tCategories(id)}
                      count={count}
                      category
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {folder && (
        <FolderActions
          folder={folder}
          rename={renameCollection}
          remove={deleteCollection}
        />
      )}

      <section aria-labelledby="folder-materials" className="space-y-4">
        <h2 id="folder-materials" className="font-display text-h3">
          {place.kind === "root" ? t("loose") : t("inFolder")}
        </h2>
        {shown.length === 0 ? (
          <div className="space-y-4 rounded-base border border-dashed border-line p-6">
            <p className="text-ink-muted">
              {place.kind === "root"
                ? materials.length === 0
                  ? t("emptyAll")
                  : t("emptyLoose")
                : t("emptyFolder")}
            </p>
            {canCreate && place.kind !== "category" && (
              <ButtonLink href="/materials/new" variant="secondary">
                {t("create")}
              </ButtonLink>
            )}
          </div>
        ) : (
          <ul className={tilesClass(view)}>
            {shown.map((material) => (
              <li key={material.id}>
                <MaterialItem
                  material={material}
                  view={view}
                  progress={progress.get(material.videoId) ?? null}
                  folders={folders}
                  pending={move.pending}
                  onMove={(to) => void moveTo(material.id, to)}
                  onDragStart={() => setDragging(material.id)}
                  onDragEnd={() => setDragging(null)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const tilesClass = (view: MaterialsView) =>
  view === "grid"
    ? "grid gap-4 sm:grid-cols-2 wide:grid-cols-3"
    : "divide-y divide-line border-y border-line";

function FolderTile({
  href,
  name,
  count,
  category = false,
  highlight = false,
}: {
  href: string;
  name: string;
  count: number;
  category?: boolean;
  highlight?: boolean;
}) {
  const t = useTranslations("materials.folders");
  return (
    <Link
      href={href}
      className={`flex min-h-11 items-center gap-3 rounded-base border bg-surface p-4 hover:border-accent ${
        highlight ? "border-dashed border-accent" : "border-line"
      }`}
    >
      <span aria-hidden="true" className="text-ink-muted">
        {category ? "◇" : "▤"}
      </span>
      <span className="min-w-0 flex-1 font-medium break-words">{name}</span>
      <span className="text-supporting text-ink-muted tabular-nums">
        {t("count", { count })}
      </span>
    </Link>
  );
}

function NewFolder({ create }: { create: typeof createCollectionAction }) {
  const t = useTranslations("materials.folders");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const action = useOrganizeAction();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    if (await action.run(() => create(name))) {
      setName("");
      setOpen(false);
    }
  }
  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t("newFolder")}
      </Button>
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label htmlFor={id} className="block text-supporting">
          {t("folderName")}
        </label>
        <input
          id={id}
          autoFocus
          value={name}
          maxLength={COLLECTION_TITLE_MAX}
          onChange={(event) => setName(event.target.value)}
          className={fieldClassName}
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        disabled={action.pending || !name.trim()}
      >
        {t("createFolder")}
      </Button>
      <Button variant="ghost" onClick={() => setOpen(false)}>
        {t("cancel")}
      </Button>
      {action.error && (
        <p role="alert" className="w-full text-supporting text-error">
          {t("folderFailed")}
        </p>
      )}
    </form>
  );
}

function FolderActions({
  folder,
  rename,
  remove,
}: {
  folder: BrowserFolder;
  rename: typeof renameCollectionAction;
  remove: typeof deleteCollectionAction;
}) {
  const t = useTranslations("materials.folders");
  const id = useId();
  const [mode, setMode] = useState<"idle" | "rename" | "delete">("idle");
  const [name, setName] = useState(folder.title);
  const action = useOrganizeAction();
  const router = useRouter();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (await action.run(() => rename(folder.id, name))) setMode("idle");
  }
  async function confirmDelete() {
    // Its materials are back at the top: go there.
    if (await action.run(() => remove(folder.id))) router.push("/materials");
  }
  return (
    <div className="space-y-3">
      {mode === "idle" && (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setMode("rename")}
          >
            {t("rename")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMode("delete")}>
            {t("deleteFolder")}
          </Button>
        </div>
      )}
      {mode === "rename" && (
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor={id} className="block text-supporting">
              {t("folderName")}
            </label>
            <input
              id={id}
              autoFocus
              value={name}
              maxLength={COLLECTION_TITLE_MAX}
              onChange={(event) => setName(event.target.value)}
              className={fieldClassName}
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={action.pending || !name.trim()}
          >
            {t("save")}
          </Button>
          <Button variant="ghost" onClick={() => setMode("idle")}>
            {t("cancel")}
          </Button>
        </form>
      )}
      {mode === "delete" && (
        <div
          role="alertdialog"
          aria-labelledby={`${id}-delete`}
          className="space-y-3 rounded-base border border-line bg-surface p-4"
        >
          <p id={`${id}-delete`}>
            {t("deleteConfirm", { name: folder.title })}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              disabled={action.pending}
              onClick={() => void confirmDelete()}
            >
              {t("deleteFolder")}
            </Button>
            <Button variant="ghost" onClick={() => setMode("idle")}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}
      {action.error && (
        <p role="alert" className="text-supporting text-error">
          {t("folderFailed")}
        </p>
      )}
    </div>
  );
}

function MaterialItem({
  material,
  view,
  progress,
  folders,
  pending,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  material: BrowserMaterial;
  view: MaterialsView;
  progress: Progress | null;
  folders: BrowserFolder[];
  pending: boolean;
  onMove: (collectionId: string | null) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const t = useTranslations("materials.folders");
  const selectId = useId();
  const seconds = material.seconds;
  const done = lastDoneDay(progress);
  const status = !progress
    ? t("notStarted")
    : progress.status === "passed"
      ? t("passed", { week: progress.week })
      : done === null
        ? t("started", { week: progress.week })
        : t("dayDone", { week: progress.week, day: done });
  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_TYPE, material.id);
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={
        view === "grid"
          ? "flex h-full flex-col gap-3 rounded-base border border-line bg-surface p-4"
          : "flex flex-col gap-3 py-4"
      }
    >
      <Link
        href={`/videos/${material.videoId}`}
        draggable={false}
        className="group block space-y-1"
      >
        <MaterialTitle
          titles={material.titles}
          className="font-medium group-hover:text-accent-ink"
          compact
        />
        {material.subtitle && (
          <span className="block text-supporting text-ink-muted">
            {material.subtitle}
          </span>
        )}
      </Link>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-supporting text-ink-muted">
        {seconds !== null && (
          <span className="tabular-nums">
            {t("length", {
              minutes: Math.floor(seconds / 60),
              seconds: Math.round(seconds % 60),
            })}
          </span>
        )}
        <span>{status}</span>
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <label htmlFor={selectId} className="text-supporting text-ink-muted">
          {t("moveTo")}
        </label>
        <select
          id={selectId}
          value={material.collectionId ?? ""}
          disabled={pending}
          onChange={(event) => onMove(event.target.value || null)}
          className="h-8 rounded-base border border-line bg-surface px-2 text-supporting focus-visible:border-accent pointer-coarse:min-h-11"
        >
          <option value="">{t("root")}</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.title}
            </option>
          ))}
        </select>
      </div>
      <details className="text-supporting">
        <summary className="tap cursor-pointer text-accent-ink">
          {t("manage")}
        </summary>
        <div className="mt-3 space-y-3">{material.details}</div>
      </details>
    </article>
  );
}

/** This device's progress for every material, read once. */
function useProgresses(): Map<string, Progress> {
  const { progress } = useStores();
  const [map, setMap] = useState<Map<string, Progress>>(new Map());
  useEffect(() => {
    let cancelled = false;
    progress
      .list()
      .then((list) => {
        if (!cancelled) setMap(new Map(list.map((p) => [p.videoId, p])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [progress]);
  return map;
}

import type { Supabase } from "@/lib/supabase/browser";
import type { Json } from "@/lib/supabase/database.types";
import {
  emptyNotebook,
  mergeNotebooks,
  NOTEBOOK_KEY,
  parseNotebook,
  type Notebook,
} from "./notebook";
import {
  CUSTOM_KEY,
  mergeCustomPrompts,
  parseCustomPrompts,
  type CustomPrompt,
} from "./custom";
import {
  mergeWritingSettings,
  parseWritingSettings,
  SETTINGS_KEY,
  type WritingSettings,
} from "./settings";
import {
  mergeWritingProgress,
  parseWritingProgress,
  WRITING_KEY_PREFIX,
  writingKey,
  type WritingProgress,
} from "./progress";

/**
 * Where WritingLoop keeps a learner's work (D187): this browser's
 * localStorage always, and the account's user_documents when signed in
 * (row level security: only the owner reads or writes them; admins'
 * pages never read them). No new table: documents are keyed
 * - `writing-<promptId>`: a prompt's progress (essays and feedback);
 * - `writing-notebook`: the notebook;
 * - `wdraft-<promptId>-<day>`: an unsent draft;
 * - `writing-settings`: the learner's settings (D194);
 * - `writing-custom`: the learner's own prompts (D196).
 * Prompt ids are at most 40 characters, so keys fit the column's 50.
 */
export const DRAFT_KEY_PREFIX = "ll-writing-draft:v1:";
export const draftKey = (promptId: string, day: number) =>
  `${DRAFT_KEY_PREFIX}${promptId}:${day}`;

const cloudProgressKey = (promptId: string) => `writing-${promptId}`;
const cloudDraftKey = (promptId: string, day: number) =>
  `wdraft-${promptId}-${day}`;
const CLOUD_NOTEBOOK = "writing-notebook";
const CLOUD_SETTINGS = "writing-settings";
const CLOUD_CUSTOM = "writing-custom";
/** Documents under "writing-" that aren't a prompt's progress. */
const NOT_PROGRESS = new Set([CLOUD_NOTEBOOK, CLOUD_SETTINGS, CLOUD_CUSTOM]);

/** Every writing key in this browser, for clearing after sign-out (D138). */
export const isWritingStorageKey = (key: string) =>
  key.startsWith(WRITING_KEY_PREFIX) ||
  key.startsWith(DRAFT_KEY_PREFIX) ||
  key === NOTEBOOK_KEY ||
  key === SETTINGS_KEY ||
  key === CUSTOM_KEY;

function read(storage: Storage, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(storage: Storage, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: kept for this page only.
  }
}

export function loadLocalProgress(
  storage: Storage,
  promptId: string,
): WritingProgress | null {
  const progress = parseWritingProgress(read(storage, writingKey(promptId)));
  return progress?.promptId === promptId ? progress : null;
}

export function saveLocalProgress(storage: Storage, progress: WritingProgress) {
  write(storage, writingKey(progress.promptId), progress);
}

export function listLocalProgress(storage: Storage): WritingProgress[] {
  const out: WritingProgress[] = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(WRITING_KEY_PREFIX)) continue;
      const progress = parseWritingProgress(read(storage, key));
      if (progress) out.push(progress);
    }
  } catch {
    // Blocked storage: nothing to list.
  }
  return out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function removeLocalProgress(storage: Storage, promptId: string) {
  try {
    storage.removeItem(writingKey(promptId));
  } catch {
    // Nothing to remove.
  }
}

export function loadLocalNotebook(storage: Storage): Notebook {
  return parseNotebook(read(storage, NOTEBOOK_KEY));
}

export function saveLocalNotebook(storage: Storage, notebook: Notebook) {
  write(storage, NOTEBOOK_KEY, notebook);
}

export function loadLocalSettings(storage: Storage): WritingSettings {
  return parseWritingSettings(read(storage, SETTINGS_KEY));
}

export function saveLocalSettings(storage: Storage, settings: WritingSettings) {
  write(storage, SETTINGS_KEY, settings);
}

export function loadLocalCustom(storage: Storage): CustomPrompt[] {
  return parseCustomPrompts(read(storage, CUSTOM_KEY));
}

export function saveLocalCustom(storage: Storage, prompts: CustomPrompt[]) {
  write(storage, CUSTOM_KEY, { prompts });
}

export type Draft = { text: string; at: string };

export function loadLocalDraft(
  storage: Storage,
  promptId: string,
  day: number,
): Draft | null {
  const value = read(storage, draftKey(promptId, day)) as Draft | null;
  return value && typeof value.text === "string" ? value : null;
}

export function saveLocalDraft(
  storage: Storage,
  promptId: string,
  day: number,
  draft: Draft | null,
) {
  if (draft === null) {
    try {
      storage.removeItem(draftKey(promptId, day));
    } catch {
      // Nothing to remove.
    }
    return;
  }
  write(storage, draftKey(promptId, day), draft);
}

/** The account's copy, through the browser's Supabase client (RLS). */
export function writingCloud(client: () => Promise<Supabase>, userId: string) {
  const fail = (error: { message: string } | null) => {
    if (error) throw new Error(`Writing sync failed: ${error.message}`);
  };
  const put = async (key: string, data: unknown) => {
    const { error } = await (
      await client()
    )
      .from("user_documents")
      .upsert({ user_id: userId, key, data: data as Json });
    fail(error);
  };
  const get = async (key: string) => {
    const { data, error } = await (
      await client()
    )
      .from("user_documents")
      .select("data")
      .eq("user_id", userId)
      .eq("key", key)
      .maybeSingle();
    fail(error);
    return data?.data ?? null;
  };
  return {
    async listProgress(): Promise<WritingProgress[]> {
      const { data, error } = await (
        await client()
      )
        .from("user_documents")
        .select("key, data")
        .eq("user_id", userId)
        .like("key", "writing-%");
      fail(error);
      return (data ?? [])
        .filter((row) => !NOT_PROGRESS.has(row.key))
        .map((row) => parseWritingProgress(row.data))
        .filter((p): p is WritingProgress => p !== null);
    },
    saveProgress: (progress: WritingProgress) =>
      put(cloudProgressKey(progress.promptId), progress),
    async getNotebook(): Promise<Notebook> {
      return parseNotebook(await get(CLOUD_NOTEBOOK));
    },
    saveNotebook: (notebook: Notebook) => put(CLOUD_NOTEBOOK, notebook),
    async getSettings(): Promise<WritingSettings> {
      return parseWritingSettings(await get(CLOUD_SETTINGS));
    },
    saveSettings: (settings: WritingSettings) => put(CLOUD_SETTINGS, settings),
    async getCustom(): Promise<CustomPrompt[]> {
      return parseCustomPrompts(await get(CLOUD_CUSTOM));
    },
    saveCustom: (prompts: CustomPrompt[]) => put(CLOUD_CUSTOM, { prompts }),
    async getDraft(promptId: string, day: number): Promise<Draft | null> {
      const value = (await get(cloudDraftKey(promptId, day))) as Draft | null;
      return value && typeof value.text === "string" ? value : null;
    },
    saveDraft: (promptId: string, day: number, draft: Draft) =>
      put(cloudDraftKey(promptId, day), draft),
    async removeDraft(promptId: string, day: number) {
      const { error } = await (
        await client()
      )
        .from("user_documents")
        .delete()
        .eq("user_id", userId)
        .eq("key", cloudDraftKey(promptId, day));
      fail(error);
    },
  };
}

export type WritingCloud = ReturnType<typeof writingCloud>;

/**
 * Brings this browser and the account together: each prompt merged
 * (mergeWritingProgress), the notebook entry by entry; both sides get the
 * result. Returns whether anything here changed.
 */
export async function syncWriting(
  storage: Storage,
  cloud: WritingCloud,
): Promise<boolean> {
  const [remote, remoteNotebook, remoteSettings, remoteCustom] =
    await Promise.all([
      cloud.listProgress(),
      cloud.getNotebook(),
      cloud.getSettings(),
      cloud.getCustom(),
    ]);
  let changed = false;
  const local = listLocalProgress(storage);
  const ids = new Set([...local, ...remote].map((p) => p.promptId));
  const uploads: Promise<void>[] = [];
  for (const id of ids) {
    const mine = local.find((p) => p.promptId === id);
    const theirs = remote.find((p) => p.promptId === id);
    const merged =
      mine && theirs ? mergeWritingProgress(mine, theirs) : (mine ?? theirs)!;
    if (JSON.stringify(merged) !== JSON.stringify(mine)) {
      saveLocalProgress(storage, merged);
      changed = true;
    }
    if (JSON.stringify(merged) !== JSON.stringify(theirs)) {
      uploads.push(cloud.saveProgress(merged));
    }
  }
  const localNotebook = loadLocalNotebook(storage);
  const notebook = mergeNotebooks(localNotebook, remoteNotebook);
  if (JSON.stringify(notebook) !== JSON.stringify(localNotebook)) {
    saveLocalNotebook(storage, notebook);
    changed = true;
  }
  if (JSON.stringify(notebook) !== JSON.stringify(remoteNotebook)) {
    uploads.push(cloud.saveNotebook(notebook));
  }
  const localSettings = loadLocalSettings(storage);
  const settings = mergeWritingSettings(localSettings, remoteSettings);
  if (JSON.stringify(settings) !== JSON.stringify(localSettings)) {
    saveLocalSettings(storage, settings);
    changed = true;
  }
  if (JSON.stringify(settings) !== JSON.stringify(remoteSettings)) {
    uploads.push(cloud.saveSettings(settings));
  }
  const localCustom = loadLocalCustom(storage);
  const custom = mergeCustomPrompts(localCustom, remoteCustom);
  if (JSON.stringify(custom) !== JSON.stringify(localCustom)) {
    saveLocalCustom(storage, custom);
    changed = true;
  }
  if (JSON.stringify(custom) !== JSON.stringify(remoteCustom)) {
    uploads.push(cloud.saveCustom(custom));
  }
  await Promise.all(uploads);
  return changed;
}

export { emptyNotebook };

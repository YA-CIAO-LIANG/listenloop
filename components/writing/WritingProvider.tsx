"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  accountsConfigured,
  loadBrowserSupabase,
  type Supabase,
} from "@/lib/supabase/browser";
import type { Notebook } from "@/lib/writing/notebook";
import type { WritingProgress } from "@/lib/writing/progress";
import type { WritingSettings } from "@/lib/writing/settings";
import { toLocalDate } from "@/lib/dates";
import {
  chatEntry,
  logProgressChange,
  type WritingLog,
} from "@/lib/writing/log";
import { mergeCustomPrompts, type CustomPrompt } from "@/lib/writing/custom";
import { mergeChats, type ChatRecord } from "@/lib/writing/chat/history";
import {
  isWritingStorageKey,
  listLocalProgress,
  loadLocalNotebook,
  loadLocalChats,
  loadLocalCustom,
  loadLocalLog,
  loadLocalProgress,
  loadLocalSettings,
  saveLocalLog,
  saveLocalNotebook,
  saveLocalChats,
  saveLocalCustom,
  saveLocalProgress,
  saveLocalSettings,
  syncWriting,
  writingCloud,
  type WritingCloud,
} from "@/lib/writing/store";

/**
 * WritingLoop's data for every page (D187): read from this browser,
 * saved here and, signed in, to the account. Once per page load while
 * signed in, this browser and the account are merged (lib/writing/store).
 * Pages re-read when `version` changes.
 */
type WritingData = {
  cloud: WritingCloud | null;
  /** Bumped after each save or sync, so readers refresh. */
  version: number;
  saveProgress(progress: WritingProgress): void;
  saveNotebook(notebook: Notebook): void;
  saveSettings(settings: Omit<WritingSettings, "at">): void;
  /** Adds or changes one of the learner's own prompts (D196). */
  saveCustom(prompt: CustomPrompt): void;
  /** Adds or changes one chat (D197). */
  saveChat(chat: ChatRecord): void;
  /** Changes the calendar's log (D201), e.g. the evening review (D203). */
  updateLog(change: (log: WritingLog) => WritingLog): void;
};

const WritingContext = createContext<WritingData>({
  cloud: null,
  version: 0,
  saveProgress: () => {},
  saveNotebook: () => {},
  saveSettings: () => {},
  saveCustom: () => {},
  saveChat: () => {},
  updateLog: () => {},
});

/** The account the device's data last belonged to (lib/sync/sync.ts). */
function accountOnDevice(storage: Storage): string | null {
  try {
    const raw = storage.getItem("ll-account:v1");
    return raw
      ? ((JSON.parse(raw) as { userId?: string }).userId ?? null)
      : null;
  } catch {
    return null;
  }
}

export function WritingProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  const [cloud] = useState(() =>
    userId && accountsConfigured
      ? writingCloud(() => loadBrowserSupabase() as Promise<Supabase>, userId)
      : null,
  );
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!cloud || !userId) return;
    const storage = window.localStorage;
    // Another account's writing never reaches this one (D138).
    const owner = accountOnDevice(storage);
    if (owner !== null && owner !== userId) {
      const keys = Array.from({ length: storage.length }, (_, i) =>
        storage.key(i),
      ).filter((key): key is string => !!key && isWritingStorageKey(key));
      for (const key of keys) storage.removeItem(key);
    }
    let cancelled = false;
    syncWriting(storage, cloud)
      .then((changed) => {
        if (changed && !cancelled) setVersion((v) => v + 1);
      })
      // Offline: keep working here; the next page load tries again.
      .catch((error: unknown) => console.warn(error));
    return () => {
      cancelled = true;
    };
  }, [cloud, userId]);

  /** Adds to the calendar's log what changed (D201); saves it if so. */
  const updateLog = useCallback(
    (change: (log: WritingLog) => WritingLog) => {
      const storage = window.localStorage;
      const before = loadLocalLog(storage);
      const after = change(before);
      if (after === before) return;
      saveLocalLog(storage, after);
      setVersion((v) => v + 1);
      void cloud?.saveLog(after).catch((e: unknown) => console.warn(e));
    },
    [cloud],
  );

  const saveProgress = useCallback(
    (progress: WritingProgress) => {
      const before = loadLocalProgress(window.localStorage, progress.promptId);
      saveLocalProgress(window.localStorage, progress);
      updateLog((log) =>
        logProgressChange(log, before, progress, toLocalDate(new Date())),
      );
      setVersion((v) => v + 1);
      void cloud?.saveProgress(progress).catch((e: unknown) => console.warn(e));
    },
    [cloud, updateLog],
  );
  const saveNotebook = useCallback(
    (notebook: Notebook) => {
      saveLocalNotebook(window.localStorage, notebook);
      setVersion((v) => v + 1);
      void cloud?.saveNotebook(notebook).catch((e: unknown) => console.warn(e));
    },
    [cloud],
  );

  const saveSettings = useCallback(
    (changes: Omit<WritingSettings, "at">) => {
      const settings = { ...changes, at: new Date().toISOString() };
      saveLocalSettings(window.localStorage, settings);
      setVersion((v) => v + 1);
      void cloud?.saveSettings(settings).catch((e: unknown) => console.warn(e));
    },
    [cloud],
  );

  const saveCustom = useCallback(
    (prompt: CustomPrompt) => {
      const all = mergeCustomPrompts(loadLocalCustom(window.localStorage), [
        { ...prompt, updatedAt: new Date().toISOString() },
      ]);
      saveLocalCustom(window.localStorage, all);
      setVersion((v) => v + 1);
      void cloud?.saveCustom(all).catch((e: unknown) => console.warn(e));
    },
    [cloud],
  );

  const saveChat = useCallback(
    (chat: ChatRecord) => {
      const all = mergeChats(loadLocalChats(window.localStorage), [
        { ...chat, updatedAt: new Date().toISOString() },
      ]);
      saveLocalChats(window.localStorage, all);
      // A chat with a message goes on the calendar (D201).
      if (!chat.deleted && chat.messages.some((m) => m.from === "me")) {
        const entry = chatEntry(chat);
        updateLog((log) =>
          log.entries[entry.id]
            ? log
            : { entries: { ...log.entries, [entry.id]: entry } },
        );
      }
      setVersion((v) => v + 1);
      void cloud?.saveChats(all).catch((e: unknown) => console.warn(e));
    },
    [cloud, updateLog],
  );

  const value = useMemo(
    () => ({
      cloud,
      version,
      saveProgress,
      saveNotebook,
      saveSettings,
      saveCustom,
      saveChat,
      updateLog,
    }),
    [
      cloud,
      version,
      saveProgress,
      saveNotebook,
      saveSettings,
      saveCustom,
      saveChat,
      updateLog,
    ],
  );
  return <WritingContext value={value}>{children}</WritingContext>;
}

export const useWritingData = () => use(WritingContext);

const noop = () => () => {};

/** Whether this is the browser (localStorage can be read). */
function useMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/** One prompt's progress here; undefined while rendering on the server. */
export function useWritingProgress(
  promptId: string,
): WritingProgress | null | undefined {
  const { version } = useWritingData();
  const mounted = useMounted();
  return useMemo(
    () =>
      mounted ? loadLocalProgress(window.localStorage, promptId) : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted, promptId, version],
  );
}

/** Every prompt started on this device (synced from the account). */
export function useAllWritingProgress(): WritingProgress[] | undefined {
  const { version } = useWritingData();
  const mounted = useMounted();
  return useMemo(
    () => (mounted ? listLocalProgress(window.localStorage) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted, version],
  );
}

export function useNotebook(): Notebook | undefined {
  const { version } = useWritingData();
  const mounted = useMounted();
  return useMemo(
    () => (mounted ? loadLocalNotebook(window.localStorage) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted, version],
  );
}

/** The learner's writing settings (defaults until the browser reads them). */
export function useWritingSettings(): WritingSettings | undefined {
  const { version } = useWritingData();
  const mounted = useMounted();
  return useMemo(
    () => (mounted ? loadLocalSettings(window.localStorage) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted, version],
  );
}

/** The learner's own prompts, newest first, without deleted ones. */
export function useCustomPrompts(): CustomPrompt[] | undefined {
  const { version } = useWritingData();
  const mounted = useMounted();
  return useMemo(
    () =>
      mounted
        ? loadLocalCustom(window.localStorage).filter((p) => !p.deleted)
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted, version],
  );
}

/** Past chats, newest first, without deleted ones (D197). */
export function useChats(): ChatRecord[] | undefined {
  const { version } = useWritingData();
  const mounted = useMounted();
  return useMemo(
    () =>
      mounted
        ? loadLocalChats(window.localStorage).filter((c) => !c.deleted)
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted, version],
  );
}

/** The writing calendar's log (D201). */
export function useWritingLog(): WritingLog | undefined {
  const { version } = useWritingData();
  const mounted = useMounted();
  return useMemo(
    () => (mounted ? loadLocalLog(window.localStorage) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted, version],
  );
}

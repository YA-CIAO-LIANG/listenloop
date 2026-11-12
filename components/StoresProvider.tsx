"use client";

import {
  applyLook,
  readSettings,
  SETTINGS_EVENT,
} from "@/lib/personal-settings";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createCloudData } from "@/lib/storage/cloud-store";
import { createLocalProgressStore } from "@/lib/storage/local-progress-store";
import { createLocalRewardStore } from "@/lib/storage/local-reward-store";
import type { ProgressStore } from "@/lib/storage/progress-store";
import type { RewardStore } from "@/lib/storage/reward-store";
import { createSyncedStores } from "@/lib/storage/synced-stores";
import {
  accountsConfigured,
  loadBrowserSupabase,
  type Supabase,
} from "@/lib/supabase/browser";
import { syncWithCloud } from "@/lib/sync/sync";

export type Stores = { progress: ProgressStore; rewards: RewardStore };

// Only touch localStorage when used, so this is safe during server rendering.
const localStores: Stores = {
  progress: createLocalProgressStore(),
  rewards: createLocalRewardStore(),
};

const StoresContext = createContext<Stores>(localStores);

/**
 * Whether progress may be shown here (D2, revised 2026-11-06): only to a
 * signed-in learner. Outside a provider (component tests) it shows, and
 * so does a build without accounts, where nobody could sign in.
 */
const ProgressVisibleContext = createContext(true);

export function useProgressVisible(): boolean {
  return useContext(ProgressVisibleContext);
}

/**
 * Where pages read and save practice data: this device only (signed out,
 * or no provider, as in tests), or this device plus the account.
 */
export function useStores(): Stores {
  return useContext(StoresContext);
}

/**
 * Signed in, syncs this device with the account once per page load and
 * sends every later save to the account too. When the sync brings in data
 * from another device, the stores are handed out anew so pages read again.
 * Give it key={userId}: signing in or out mounts a fresh provider.
 * `accounts`: whether this build can sign in at all.
 */
export function StoresProvider({
  userId,
  accounts = true,
  children,
}: {
  userId: string | null;
  accounts?: boolean;
  children: ReactNode;
}) {
  const [cloud] = useState(() => {
    if (!userId || !accountsConfigured) return null;
    // Configured, so never null; loaded in the background (D120).
    return createCloudData(
      () => loadBrowserSupabase() as Promise<Supabase>,
      userId,
    );
  });
  const [stores, setStores] = useState<Stores>(() =>
    cloud
      ? createSyncedStores(localStores, cloud, reportSyncError)
      : localStores,
  );

  useEffect(() => {
    if (!cloud || !userId) return;
    let cancelled = false;
    syncWithCloud({
      userId,
      local: localStores,
      cloud,
      storage: window.localStorage,
    })
      .then(({ changedLocal }) => {
        // The account's look (wallpaper, accent, theme) on the page now.
        applyLook(window.localStorage, document.documentElement);
        // A new object: effects keyed on a store run again and re-read.
        if (changedLocal && !cancelled) {
          setStores(createSyncedStores(localStores, cloud, reportSyncError));
        }
      })
      // Offline or blocked: keep working on this device; the next page
      // load tries again.
      .catch(reportSyncError);
    return () => {
      cancelled = true;
    };
  }, [cloud, userId]);

  // A setting changed on this page: copied to the account (D138).
  useEffect(() => {
    if (!cloud?.saveSettings) return;
    let timer: number | undefined;
    const upload = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void cloud
          .saveSettings?.(readSettings(window.localStorage))
          .catch(reportSyncError);
      }, 800);
    };
    window.addEventListener(SETTINGS_EVENT, upload);
    return () => {
      window.removeEventListener(SETTINGS_EVENT, upload);
      window.clearTimeout(timer);
    };
  }, [cloud]);

  return (
    <StoresContext value={stores}>
      <ProgressVisibleContext value={!accounts || userId !== null}>
        {children}
      </ProgressVisibleContext>
    </StoresContext>
  );
}

function reportSyncError(error: unknown) {
  console.warn(
    "ListenLoop: cloud sync will retry on the next page load.",
    error,
  );
}

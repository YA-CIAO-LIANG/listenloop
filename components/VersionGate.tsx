"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, type ReactNode } from "react";
import { versionToShow } from "@/lib/practice-material";
import { pinnedVersion } from "@/lib/progress";
import type { ProgressStore } from "@/lib/storage/progress-store";
import { useVideoProgress } from "./useVideoProgress";

/**
 * Keeps a week on the practice version it started with (D44): if the
 * learner's week is fixed to another version than the page shows, the
 * page reloads with ?v=<that version> before anything mounts, so a
 * session never records answers against different sentences. Only for
 * created practices (`version` set); built-in videos skip it.
 */
export function VersionGate({
  videoId,
  version,
  children,
  store,
}: {
  videoId: string;
  /** The version this page shows. */
  version: number | undefined;
  children: ReactNode;
  /** Injected in tests; defaults to the account or this device. */
  store?: ProgressStore;
}) {
  const t = useTranslations("cycle");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { progress, loaded } = useVideoProgress(videoId, store);
  const target = loaded
    ? versionToShow(pinnedVersion(progress), version, searchParams.get("v"))
    : null;

  useEffect(() => {
    if (target === null) return;
    const query = new URLSearchParams(searchParams);
    query.set("v", String(target));
    router.replace(`${pathname}?${query}`);
  }, [target, pathname, router, searchParams]);

  if (version === undefined) return children;
  if (!loaded || target !== null) {
    return (
      <p role="status" className="practice-column text-ink-muted">
        {t("loading")}
      </p>
    );
  }
  return children;
}

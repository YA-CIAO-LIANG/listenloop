"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { Progress, ProgressStatus } from "@/lib/progress";
import type { ProgressStore } from "@/lib/storage/progress-store";
import { Button } from "./Button";
import { useStores } from "./StoresProvider";
import { ProgressLabel } from "./VideoProgressLabel";

/** Group order on the page. */
const GROUPS: ProgressStatus[] = ["in-progress", "repeat", "passed"];

const linkClassName =
  "text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink";

type MyPracticesProps = {
  /** Published videos' titles by id (built on the server). */
  titles: Record<string, string>;
  /** Injected in tests; defaults to the page's stores. */
  store?: ProgressStore;
};

/**
 * Every started practice, grouped: in progress, waiting to repeat a week,
 * passed. Each can be removed (after a confirmation), which deletes its
 * progress here and, signed in, in the account; the practice calendar
 * keeps its history. Videos no longer in the library are listed too, so
 * their progress can still be removed.
 */
export function MyPractices({ titles, store }: MyPracticesProps) {
  const t = useTranslations("practices");
  const stores = useStores();
  const progressStore = store ?? stores.progress;
  const [practices, setPractices] = useState<Progress[] | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "removed" | "failed";
    title: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    progressStore
      .list()
      .catch(() => [])
      .then((list) => {
        if (!cancelled) setPractices(list);
      });
    return () => {
      cancelled = true;
    };
  }, [progressStore]);

  const titleOf = (videoId: string) => titles[videoId] ?? t("unknownVideo");

  async function remove(videoId: string) {
    setPending(true);
    const title = titleOf(videoId);
    try {
      await progressStore.remove(videoId);
      setPractices((list) => list?.filter((p) => p.videoId !== videoId) ?? []);
      setNotice({ kind: "removed", title });
      setConfirming(null);
    } catch {
      setNotice({ kind: "failed", title });
    } finally {
      setPending(false);
    }
  }

  if (!practices) return <p className="mt-8 text-ink-muted">{t("loading")}</p>;

  const sorted = [...practices].sort((a, b) =>
    titleOf(a.videoId).localeCompare(titleOf(b.videoId)),
  );

  return (
    <>
      <p
        aria-live="polite"
        className={`mt-6 text-supporting ${notice?.kind === "failed" ? "text-error" : "text-ink-muted"}`}
      >
        {notice &&
          t(notice.kind === "removed" ? "removed" : "removeFailed", {
            title: notice.title,
          })}
      </p>
      {sorted.length === 0 ? (
        <div className="mt-4 space-y-4">
          <p className="text-ink-muted">{t("empty")}</p>
          <Link href="/#library" className={linkClassName}>
            {t("toLibrary")}
          </Link>
        </div>
      ) : (
        GROUPS.map((status) => {
          const group = sorted.filter((p) => p.status === status);
          if (group.length === 0) return null;
          return (
            <section
              key={status}
              aria-labelledby={`practices-${status}`}
              className="mt-10"
            >
              <h2
                id={`practices-${status}`}
                className="flex items-baseline gap-3 font-display text-h3"
              >
                {t(`groups.${status}`)}
                <span className="text-supporting font-normal text-ink-muted">
                  {t("count", { count: group.length })}
                </span>
              </h2>
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {group.map((progress) => {
                  const { videoId } = progress;
                  const known = videoId in titles;
                  return (
                    <li key={videoId} className="py-4">
                      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                        <div>
                          {known ? (
                            <Link
                              href={`/videos/${videoId}`}
                              lang="en"
                              className="font-medium hover:text-accent-ink"
                            >
                              {titleOf(videoId)}
                            </Link>
                          ) : (
                            <p className="font-medium text-ink-muted">
                              {titleOf(videoId)}
                            </p>
                          )}
                          <ProgressLabel progress={progress} />
                        </div>
                        {confirming !== videoId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirming(videoId)}
                          >
                            {t("remove")}
                          </Button>
                        )}
                      </div>
                      {confirming === videoId && (
                        <div className="mt-4 space-y-3 rounded-base border border-error p-4">
                          <p className="text-supporting">
                            {t("removeConfirm", { title: titleOf(videoId) })}
                          </p>
                          <div className="flex flex-wrap gap-3">
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => remove(videoId)}
                              disabled={pending}
                            >
                              {pending ? t("removing") : t("removeButton")}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirming(null)}
                              disabled={pending}
                            >
                              {t("cancel")}
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </>
  );
}

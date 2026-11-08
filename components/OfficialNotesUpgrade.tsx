"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  upgradeOfficialNotes as upgradeAction,
  type UpgradeNotesResult,
} from "@/app/admin/official/actions";
import type { UsageBlock } from "@/lib/usage";
import { Button } from "./Button";
import { ProgressBar } from "./ProgressBar";
import { UsageLimitMessage } from "./UsageLimitMessage";

type Item = { id: string; title: string };

/**
 * "Regenerate notes" for official materials (D80): the ones whose notes
 * aren't current, ticked, are brought up to date one by one on the batch
 * allowance (D77), a chunk of sentences per call, with progress. Stops
 * at the first problem and says which.
 */
export function OfficialNotesUpgrade({
  items,
  upgrade = upgradeAction,
}: {
  /** Official materials whose notes aren't current. */
  items: readonly Item[];
  /** Injected in tests; the Server Action otherwise. */
  upgrade?: typeof upgradeAction;
}) {
  const t = useTranslations("adminOfficial.upgrade");
  const router = useRouter();
  const ids = useId();
  const [chosen, setChosen] = useState<string[]>(() => items.map((i) => i.id));
  const [running, setRunning] = useState<{
    title: string;
    done: number;
    total: number;
  } | null>(null);
  const [finished, setFinished] = useState(0);
  const [failure, setFailure] = useState<{
    title: string;
    reason: string;
    limit?: UsageBlock;
  } | null>(null);

  if (items.length === 0) {
    return <p className="text-supporting text-ink-muted">{t("allCurrent")}</p>;
  }

  async function run() {
    setFailure(null);
    setFinished(0);
    for (const item of items.filter((i) => chosen.includes(i.id))) {
      let previous = -1;
      for (;;) {
        const result = await upgrade(item.id).catch((): UpgradeNotesResult => ({
          ok: false,
          reason: "failed",
        }));
        if (!result.ok) {
          setRunning(null);
          setFailure({
            title: item.title,
            reason: result.reason,
            limit: result.limit,
          });
          router.refresh();
          return;
        }
        setRunning({
          title: item.title,
          done: result.done,
          total: result.total,
        });
        if (result.done >= result.total) break;
        // No progress means something's wrong: never loop forever.
        if (result.done <= previous) {
          setRunning(null);
          setFailure({ title: item.title, reason: "failed" });
          return;
        }
        previous = result.done;
      }
      setFinished((n) => n + 1);
    }
    setRunning(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="font-medium">
          {t("legend", { count: items.length })}
        </legend>
        {items.map((item) => (
          <label
            key={item.id}
            htmlFor={`${ids}-${item.id}`}
            className="flex items-center gap-3 text-supporting pointer-coarse:min-h-11"
          >
            <input
              id={`${ids}-${item.id}`}
              type="checkbox"
              checked={chosen.includes(item.id)}
              disabled={running !== null}
              onChange={(event) =>
                setChosen((list) =>
                  event.target.checked
                    ? [...list, item.id]
                    : list.filter((id) => id !== item.id),
                )
              }
              className="size-4 accent-accent"
            />
            {item.title}
          </label>
        ))}
      </fieldset>
      <p className="text-supporting text-ink-muted">{t("note")}</p>
      <Button
        variant="primary"
        disabled={running !== null || chosen.length === 0}
        onClick={run}
      >
        {t("run", { count: chosen.length })}
      </Button>
      <div aria-live="polite" className="space-y-2">
        {running && (
          <div className="max-w-sm">
            <ProgressBar
              value={running.done}
              max={running.total}
              label={t("working", { title: running.title })}
            />
          </div>
        )}
        {!running && finished > 0 && !failure && (
          <p className="text-supporting text-success">
            {t("done", { count: finished })}
          </p>
        )}
        {failure && (
          <p role="alert" className="text-supporting text-error">
            {t("stopped", { title: failure.title })}{" "}
            {failure.reason === "limit" ? (
              <UsageLimitMessage
                block={failure.limit}
                fallback={t("errors.limit")}
              />
            ) : (
              t(
                `errors.${failure.reason === "busy" || failure.reason === "unavailable" ? failure.reason : "failed"}`,
              )
            )}
          </p>
        )}
      </div>
    </div>
  );
}

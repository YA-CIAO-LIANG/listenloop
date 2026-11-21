"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toLocalDate } from "@/lib/dates";
import {
  dueToday,
  isMastered,
  reviewEntry,
  type NotebookEntry,
} from "@/lib/writing/notebook";
import { Button } from "../Button";
import { Card } from "../Card";
import { useToday } from "../useToday";
import { useNotebook, useWritingData } from "./WritingProvider";

/**
 * "My writing notebook" (D187): today's reviews first (mistakes and
 * patterns of every prompt, mixed), recalled before the answer shows;
 * then everything in it, by when it comes back.
 */
export function NotebookView() {
  const t = useTranslations("writing.notebook");
  const tw = useTranslations("writing");
  const today = useToday();
  const notebook = useNotebook();
  const { saveNotebook } = useWritingData();
  const [shown, setShown] = useState<string | null>(null);
  const [attempt, setAttempt] = useState("");
  if (!today || !notebook) return null;
  const due = dueToday(notebook, today);
  const all = Object.values(notebook.entries).sort((a, b) =>
    a.due < b.due ? -1 : 1,
  );
  const current = due[0];

  const answer = (entry: NotebookEntry, remembered: boolean) => {
    saveNotebook({
      entries: {
        ...notebook.entries,
        [entry.id]: reviewEntry(entry, remembered, toLocalDate(new Date())),
      },
    });
    setShown(null);
    setAttempt("");
  };

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="nb-due" className="flex flex-col gap-3">
        <h2 id="nb-due" className="font-display text-h3">
          {t("due", { count: due.length })}
        </h2>
        {!current ? (
          <p className="text-ink-muted">
            {all.length ? t("noneDue") : t("empty")}
          </p>
        ) : (
          <Card className="flex flex-col gap-3">
            <p className="text-supporting text-ink-muted">
              {current.kind === "error"
                ? t("fixThis")
                : current.kind === "chat"
                  ? t("fromChinese")
                  : t("useThis")}
            </p>
            <p
              lang={current.kind === "chat" ? "zh-Hant" : "en"}
              className="font-medium"
            >
              {current.text}
            </p>
            {current.kind === "pattern" && (
              <p className="text-supporting text-ink-muted">{current.note}</p>
            )}
            <label className="flex flex-col gap-1">
              <span className="text-supporting">{t("yourTurn")}</span>
              <textarea
                lang="en"
                rows={2}
                value={attempt}
                onChange={(e) => setAttempt(e.target.value)}
                className="w-full rounded-base border border-line bg-surface p-3"
                spellCheck={false}
              />
            </label>
            {shown !== current.id ? (
              <div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShown(current.id)}
                >
                  {t("show")}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3" role="status">
                <p className="text-supporting">
                  <span className="text-ink-muted">{t("answer")}</span>{" "}
                  <span lang="en" className="font-medium">
                    {current.answer}
                  </span>
                </p>
                {current.kind !== "pattern" && current.note && (
                  <p className="text-supporting">{current.note}</p>
                )}
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => answer(current, true)}
                  >
                    {t("remembered")}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => answer(current, false)}
                  >
                    {t("forgot")}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </section>
      {all.length > 0 && (
        <section aria-labelledby="nb-all" className="flex flex-col gap-3">
          <h2 id="nb-all" className="font-display text-h3">
            {t("all", { count: all.length })}
          </h2>
          <ul className="flex flex-col gap-2">
            {all.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap justify-between gap-2 border-b border-line pb-2 text-supporting"
              >
                <span className="min-w-0">
                  <span className="mr-2 text-ink-muted">
                    {entry.kind === "error"
                      ? entry.type
                        ? tw(`errors.${entry.type}`)
                        : t("mistake")
                      : entry.kind === "chat"
                        ? t("chat")
                        : t("pattern")}
                  </span>
                  <span lang="en">
                    {entry.kind === "chat" ? entry.answer : entry.text}
                  </span>
                </span>
                <span className="text-ink-muted tabular-nums">
                  {isMastered(entry)
                    ? t("mastered")
                    : t("next", { date: entry.due, stage: entry.stage })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

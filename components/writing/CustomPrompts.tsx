"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import type { CycleDay } from "@/lib/cycle";
import {
  CUSTOM_KINDS,
  customWritingPrompt,
  MAX_CUSTOM_TASK,
  MAX_CUSTOM_TITLE,
  newCustomId,
  type CustomKind,
  type CustomPrompt,
} from "@/lib/writing/custom";
import type { WritingPrompt } from "@/lib/writing/types";
import { Button } from "../Button";
import { ButtonLink } from "../ButtonLink";
import { Card } from "../Card";
import { Tag } from "../Tag";
import { PromptTask } from "./PromptTask";
import { WritingDay } from "./WritingDay";
import { WritingOverview } from "./WritingOverview";
import { useCustomPrompts, useWritingData } from "./WritingProvider";

/** A custom prompt's name: its title, or its kind and the day it began. */
export function useCustomName() {
  const t = useTranslations("writingCustom");
  const format = useFormatter();
  return (prompt: CustomPrompt) =>
    prompt.title ||
    t("untitled", {
      kind: t(`kinds.${prompt.kind}.name`),
      date: format.dateTime(new Date(prompt.createdAt), {
        month: "numeric",
        day: "numeric",
      }),
    });
}

/** Prompt id → name, for the lists that show official and own prompts. */
export function useCustomTitles(): Record<string, string> {
  const prompts = useCustomPrompts();
  const name = useCustomName();
  return Object.fromEntries((prompts ?? []).map((p) => [p.id, name(p)]));
}

/** The learner's prompt as the writing pages use it; null: not here. */
function useCustomWritingPrompt(id: string): WritingPrompt | null | undefined {
  const t = useTranslations("writingCustom");
  const prompts = useCustomPrompts();
  const name = useCustomName();
  if (!prompts) return undefined;
  const prompt = prompts.find((p) => p.id === id);
  if (!prompt) return null;
  const shown = name(prompt);
  return customWritingPrompt(
    prompt,
    { en: shown, zh: shown },
    prompt.kind === "custom" ? "" : t(`kinds.${prompt.kind}.task`),
  );
}

function NotHere() {
  const t = useTranslations("writingCustom");
  return (
    <Card role="status" className="flex flex-col gap-3">
      <p>{t("notHere")}</p>
      <div>
        <ButtonLink href="/writing" variant="secondary" size="sm">
          {t("toWriting")}
        </ButtonLink>
      </div>
    </Card>
  );
}

/** /writing/c-…: the learner's prompt and its week (D196). */
export function CustomPromptOverview({ id }: { id: string }) {
  const t = useTranslations("writingCustom");
  const prompt = useCustomWritingPrompt(id);
  const prompts = useCustomPrompts();
  const { saveCustom } = useWritingData();
  const router = useRouter();
  if (prompt === undefined) return null;
  if (prompt === null) return <NotHere />;
  const own = prompts?.find((p) => p.id === id);
  return (
    <>
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Tag>{t(`kinds.${prompt.custom ?? "custom"}.name`)}</Tag>
          <Tag>{t("private")}</Tag>
        </div>
        <h1 className="font-display text-h1">{prompt.title.zh}</h1>
        <p className="text-ink-muted">{t("privateNote")}</p>
      </header>
      <PromptTask prompt={prompt} />
      <WritingOverview promptId={prompt.id} />
      {own && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (!window.confirm(t("deleteConfirm"))) return;
              saveCustom({ ...own, deleted: true });
              router.push("/writing");
            }}
          >
            {t("delete")}
          </Button>
        </div>
      )}
    </>
  );
}

/** /writing/c-…/day/N: one day of the learner's own prompt (D196). */
export function CustomPromptDay({
  id,
  day,
  signedIn,
}: {
  id: string;
  day: CycleDay;
  signedIn: boolean;
}) {
  const t = useTranslations("writing");
  const prompt = useCustomWritingPrompt(id);
  if (prompt === undefined) return null;
  if (prompt === null) return <NotHere />;
  return (
    <>
      <nav className="text-supporting">
        <Link
          href={`/writing/${prompt.id}`}
          className="tap inline-flex min-h-8 items-center underline pointer-coarse:min-h-11"
        >
          {prompt.title.zh}
        </Link>
      </nav>
      <h1 className="font-display text-h2 split:text-h1">
        {t("overview.dayN", { day })} · {t(`overview.dayName.${day}`)}
      </h1>
      <WritingDay
        prompt={prompt}
        day={day}
        signedIn={signedIn}
        title={prompt.title.zh}
      />
    </>
  );
}

/** /writing/new: the learner's own task, a diary, or free writing (D196). */
export function CustomPromptForm() {
  const t = useTranslations("writingCustom");
  const { saveCustom } = useWritingData();
  const router = useRouter();
  const [kind, setKind] = useState<CustomKind>("custom");
  const [title, setTitle] = useState("");
  const [task, setTask] = useState("");
  const [error, setError] = useState(false);
  return (
    <form
      className="flex max-w-reading flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (kind === "custom" && !task.trim()) {
          setError(true);
          return;
        }
        const now = new Date().toISOString();
        const prompt: CustomPrompt = {
          id: newCustomId(),
          kind,
          title: title.trim().slice(0, MAX_CUSTOM_TITLE),
          task: kind === "custom" ? task.trim().slice(0, MAX_CUSTOM_TASK) : "",
          createdAt: now,
          updatedAt: now,
        };
        saveCustom(prompt);
        router.push(`/writing/${prompt.id}`);
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">{t("kind")}</legend>
        {CUSTOM_KINDS.map((k) => (
          <label
            key={k}
            className="tap flex min-h-8 items-start gap-3 pointer-coarse:min-h-11"
          >
            <input
              type="radio"
              name="custom-kind"
              value={k}
              checked={kind === k}
              onChange={() => setKind(k)}
              className="mt-1 size-4 shrink-0 accent-accent"
            />
            <span>
              {t(`kinds.${k}.name`)}
              <span className="block text-supporting text-ink-muted">
                {t(`kinds.${k}.hint`)}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1">
        <span className="font-medium">{t("title")}</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={MAX_CUSTOM_TITLE}
          className="min-h-10 rounded-base border border-line bg-surface px-3 pointer-coarse:min-h-11"
          aria-describedby="custom-title-hint"
        />
        <span id="custom-title-hint" className="text-supporting text-ink-muted">
          {t("titleHint")}
        </span>
      </label>
      {kind === "custom" && (
        <label className="flex flex-col gap-1">
          <span className="font-medium">{t("task")}</span>
          <textarea
            value={task}
            onChange={(e) => {
              setTask(e.target.value);
              setError(false);
            }}
            maxLength={MAX_CUSTOM_TASK}
            rows={4}
            aria-invalid={error}
            aria-describedby="custom-task-hint"
            className="rounded-base border border-line bg-surface p-3"
          />
          <span
            id="custom-task-hint"
            className={
              error
                ? "text-supporting text-error"
                : "text-supporting text-ink-muted"
            }
          >
            {error ? t("taskMissing") : t("taskHint")}
          </span>
        </label>
      )}
      <p className="text-supporting text-ink-muted">{t("privateNote")}</p>
      <div>
        <Button type="submit" variant="primary">
          {t("create")}
        </Button>
      </div>
    </form>
  );
}

/** On /writing: the learner's own prompts and "Write my own" (D196). */
export function CustomPromptList() {
  const t = useTranslations("writingCustom");
  const prompts = useCustomPrompts();
  const name = useCustomName();
  return (
    <section aria-labelledby="custom-prompts" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="custom-prompts" className="font-display text-h3">
          {t("heading")}
        </h2>
        <ButtonLink href="/writing/new" variant="secondary" size="sm">
          {t("new")}
        </ButtonLink>
      </div>
      {prompts && prompts.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {prompts.map((prompt) => (
            <li key={prompt.id}>
              <Link
                href={`/writing/${prompt.id}`}
                className="tap inline-flex min-h-8 items-center gap-2 underline pointer-coarse:min-h-11"
              >
                {name(prompt)}
                <span className="text-supporting text-ink-muted no-underline">
                  · {t(`kinds.${prompt.kind}.name`)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-supporting text-ink-muted">{t("empty")}</p>
      )}
    </section>
  );
}

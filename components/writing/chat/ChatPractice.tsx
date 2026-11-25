"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { startChat, type StartChatResult } from "@/app/writing/chat/actions";
import { toLocalDate } from "@/lib/dates";
import { deletedChat, type ChatRecord } from "@/lib/writing/chat/history";
import { MAX_SITUATION } from "@/lib/writing/chat/limits";
import { chatNotebookItems, chatSummary } from "@/lib/writing/chat/summary";
import {
  CHAT_LENGTHS,
  CHAT_LEVELS,
  CHAT_SCENARIOS,
  type ChatMessage,
} from "@/lib/writing/chat/types";
import { addToNotebook } from "@/lib/writing/notebook";
import { loadLocalNotebook } from "@/lib/writing/store";
import { Button } from "../../Button";
import { ButtonLink } from "../../ButtonLink";
import { Card } from "../../Card";
import { useChats, useWritingData } from "../WritingProvider";
import { Avatar, ChatRoom, type ChatSetup } from "./ChatRoom";

type Stage =
  | { kind: "setup" }
  | {
      kind: "room";
      setup: ChatSetup;
      sessionId: string;
      startedAt: string;
    }
  | { kind: "summary"; chatId: string };

/**
 * Chat practice (D197): choose the time, the situation, and the level;
 * chat; then the summary (three mistakes, three natural phrases, the
 * whole conversation), which also goes to the writing notebook. Past
 * chats are listed below the setup, to read again or delete.
 */
export function ChatPractice({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("writingChat");
  const tPlans = useTranslations("plans");
  const { saveChat, saveNotebook } = useWritingData();
  const chats = useChats();
  const [stage, setStage] = useState<Stage>({ kind: "setup" });
  const [setup, setSetup] = useState<ChatSetup>({
    scenario: "classmate",
    level: "intermediate",
    minutes: 5,
    teen: false,
  });
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<StartChatResult | null>(null);

  if (stage.kind === "room") {
    const partner = t(`scenarios.${stage.setup.scenario}.partner`);
    return (
      <ChatRoom
        setup={stage.setup}
        sessionId={stage.sessionId}
        startedAt={stage.startedAt}
        partner={partner}
        opening={t(`scenarios.${stage.setup.scenario}.opening`)}
        onEnd={(messages, stopped) => {
          const chat: ChatRecord = {
            id: stage.sessionId,
            scenario: stage.setup.scenario,
            ...(stage.setup.custom ? { custom: stage.setup.custom } : {}),
            level: stage.setup.level,
            minutes: stage.setup.minutes,
            startedAt: stage.startedAt,
            endedAt: new Date().toISOString(),
            messages,
            updatedAt: new Date().toISOString(),
          };
          saveChat(chat);
          // Mistakes and phrases come back in 1, 3, and 7 days.
          if (!stopped) {
            const items = chatNotebookItems(chat.id, messages);
            if (items.length) {
              saveNotebook(
                addToNotebook(
                  loadLocalNotebook(window.localStorage),
                  items,
                  toLocalDate(new Date()),
                ),
              );
            }
          }
          setStage({ kind: "summary", chatId: chat.id });
        }}
      />
    );
  }

  if (stage.kind === "summary") {
    const chat = chats?.find((c) => c.id === stage.chatId);
    return (
      <ChatSummaryView
        chat={chat}
        onAgain={() => setStage({ kind: "setup" })}
      />
    );
  }

  const start = async () => {
    setBusy(true);
    setRefusal(null);
    try {
      const result = await startChat({ minutes: setup.minutes });
      if (!result.ok) {
        setRefusal(result);
        return;
      }
      setStage({
        kind: "room",
        setup,
        sessionId: result.sessionId,
        startedAt: result.startedAt,
      });
    } catch {
      setRefusal({ ok: false, reason: "unavailable" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-10">
      {!signedIn ? (
        <Card className="flex flex-col gap-3">
          <p>{t("signIn")}</p>
          <div>
            <ButtonLink href="/login?next=/writing/chat" variant="primary">
              {t("signInButton")}
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <form
          className="flex max-w-reading flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            void start();
          }}
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="font-medium">{t("setup.minutes")}</legend>
            <div className="flex flex-wrap gap-2">
              {CHAT_LENGTHS.map((m) => (
                <label
                  key={m}
                  className="tap inline-flex min-h-10 items-center gap-2 rounded-base border border-line px-3 has-checked:border-ink pointer-coarse:min-h-11"
                >
                  <input
                    type="radio"
                    name="chat-minutes"
                    checked={setup.minutes === m}
                    onChange={() => setSetup({ ...setup, minutes: m })}
                    className="size-4 accent-accent"
                  />
                  {t("setup.minutesN", { n: m })}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="font-medium">{t("setup.scenario")}</legend>
            <div className="grid gap-2 split:grid-cols-2">
              {CHAT_SCENARIOS.map((s) => (
                <label
                  key={s}
                  className="tap flex min-h-11 items-center gap-3 rounded-base border border-line px-3 py-2 has-checked:border-ink"
                >
                  <input
                    type="radio"
                    name="chat-scenario"
                    checked={setup.scenario === s}
                    onChange={() => setSetup({ ...setup, scenario: s })}
                    className="size-4 shrink-0 accent-accent"
                  />
                  <Avatar name={t(`scenarios.${s}.partner`)} />
                  <span className="min-w-0">
                    {t(`scenarios.${s}.name`)}
                    <span className="block text-supporting text-ink-muted">
                      {t(`scenarios.${s}.hint`)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {setup.scenario === "custom" && (
              <label className="flex flex-col gap-1">
                <span>{t("setup.custom")}</span>
                <input
                  value={setup.custom ?? ""}
                  maxLength={MAX_SITUATION}
                  required
                  onChange={(e) =>
                    setSetup({ ...setup, custom: e.target.value })
                  }
                  className="min-h-11 rounded-base border border-line bg-surface px-3"
                />
              </label>
            )}
          </fieldset>
          <label className="flex flex-col gap-1 split:max-w-xs">
            <span className="font-medium">{t("setup.level")}</span>
            <select
              value={setup.level}
              onChange={(e) =>
                setSetup({
                  ...setup,
                  level: e.target.value as ChatSetup["level"],
                })
              }
              className="min-h-11 rounded-base border border-line bg-surface px-3"
            >
              {CHAT_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {t(`levels.${l}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="tap flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={setup.teen}
              onChange={(e) => setSetup({ ...setup, teen: e.target.checked })}
              className="size-4 accent-accent"
            />
            {t("setup.teen")}
          </label>
          <p className="text-supporting text-ink-muted">{t("setup.rules")}</p>
          <p className="text-supporting text-ink-muted">
            {t("setup.countNote")}
          </p>
          {refusal && !refusal.ok && (
            <p role="alert" className="text-error">
              {refusal.reason === "plan" && refusal.block
                ? tPlans(`limits.${refusal.block.limit}`, {
                    max: refusal.block.max ?? 0,
                  })
                : t(`errors.${refusal.reason}`)}
            </p>
          )}
          <div>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? t("setup.starting") : t("setup.start")}
            </Button>
          </div>
        </form>
      )}
      <ChatHistory
        chats={chats ?? []}
        onOpen={(id) => setStage({ kind: "summary", chatId: id })}
        onDelete={(chat) => saveChat(deletedChat(chat))}
      />
    </div>
  );
}

function ChatHistory({
  chats,
  onOpen,
  onDelete,
}: {
  chats: ChatRecord[];
  onOpen: (id: string) => void;
  onDelete: (chat: ChatRecord) => void;
}) {
  const t = useTranslations("writingChat");
  const format = useFormatter();
  if (!chats.length) return null;
  return (
    <section aria-labelledby="chat-history" className="flex flex-col gap-3">
      <h2 id="chat-history" className="font-display text-h3">
        {t("history.heading")}
      </h2>
      <p className="text-supporting text-ink-muted">{t("history.private")}</p>
      <ul className="flex flex-col gap-2">
        {chats.map((chat) => (
          <li
            key={chat.id}
            className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2"
          >
            <span>
              {t(`scenarios.${chat.scenario}.name`)}
              <span className="text-supporting text-ink-muted">
                {" · "}
                {format.dateTime(new Date(chat.startedAt), {
                  month: "numeric",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </span>
            <span className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onOpen(chat.id)}
              >
                {t("history.open")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (window.confirm(t("history.deleteConfirm")))
                    onDelete(chat);
                }}
              >
                {t("history.delete")}
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** After a chat, or a past one opened again (D197). */
function ChatSummaryView({
  chat,
  onAgain,
}: {
  chat: ChatRecord | undefined;
  onAgain: () => void;
}) {
  const t = useTranslations("writingChat");
  const tw = useTranslations("writing");
  if (!chat) return null;
  const { mistakes, phrases } = chatSummary(chat.messages);
  const partner = t(`scenarios.${chat.scenario}.partner`);
  return (
    <div className="flex flex-col gap-8">
      <h2 className="font-display text-h2">{t("summary.heading")}</h2>
      <section aria-labelledby="chat-mistakes" className="flex flex-col gap-3">
        <h3 id="chat-mistakes" className="font-display text-h3">
          {t("summary.mistakes")}
        </h3>
        {mistakes.length === 0 ? (
          <p className="text-ink-muted">{t("summary.noMistakes")}</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {mistakes.map((c, i) => (
              <li key={i}>
                <Card className="flex flex-col gap-1">
                  <p className="text-supporting text-ink-muted">
                    {tw(`errors.${c.type}`)}
                  </p>
                  <p lang="en">
                    <del className="text-error">{c.original}</del> →{" "}
                    <span className="font-medium">{c.fixed}</span>
                  </p>
                  <p className="text-supporting">{c.why}</p>
                </Card>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section aria-labelledby="chat-phrases" className="flex flex-col gap-3">
        <h3 id="chat-phrases" className="font-display text-h3">
          {t("summary.phrases")}
        </h3>
        {phrases.length === 0 ? (
          <p className="text-ink-muted">{t("summary.noPhrases")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {phrases.map((p, i) => (
              <li key={i}>
                <span lang="en" className="font-medium">
                  {p.en}
                </span>{" "}
                <span className="text-supporting text-ink-muted">{p.zh}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-supporting text-ink-muted">
          {t("summary.notebook")}
        </p>
      </section>
      <section aria-labelledby="chat-review" className="flex flex-col gap-3">
        <h3 id="chat-review" className="font-display text-h3">
          {t("summary.review")}
        </h3>
        <ol className="flex flex-col gap-2">
          {chat.messages.map((m: ChatMessage, i) => (
            <li
              key={i}
              className={m.from === "me" ? "self-end text-right" : "self-start"}
            >
              <p className="text-metadata text-ink-muted">
                {m.from === "me" ? t("room.me") : partner}
              </p>
              <p lang="en">{m.text}</p>
              {m.correction && (
                <p className="text-supporting text-ink-muted" lang="en">
                  ✎ {m.correction.fixed}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" onClick={onAgain}>
          {t("summary.again")}
        </Button>
        <ButtonLink href="/writing/notebook" variant="secondary">
          {tw("notebook.title")}
        </ButtonLink>
      </div>
    </div>
  );
}

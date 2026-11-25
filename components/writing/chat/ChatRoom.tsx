"use client";

import { useTranslations } from "next-intl";
import { writingTimeId } from "@/lib/writing/progress";
import { CHAT_TIME_ID } from "@/lib/writing/log";
import { usePracticeTimer } from "../../usePracticeTimer";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  endChat,
  reportChatReply,
  sendChat,
  type ChatReplyResult,
} from "@/app/writing/chat/actions";
import { MAX_MESSAGE } from "@/lib/writing/chat/limits";
import { HELPLINES } from "@/lib/writing/chat/safety";
import type {
  ChatLevel,
  ChatMessage,
  ChatScenario,
} from "@/lib/writing/chat/types";
import { Button } from "../../Button";
import { Card } from "../../Card";
import { Dialog } from "../../Dialog";
import { useFitToViewport } from "../WritingWorkspace";
import { UpsellToAll } from "@/components/UpsellToAll";

export type ChatSetup = {
  scenario: ChatScenario;
  custom?: string;
  level: ChatLevel;
  minutes: number;
  teen: boolean;
};

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** The partner's picture: their initial on the accent colour, no photos. */
export function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/14 font-medium text-accent-ink"
    >
      {name.slice(0, 1)}
    </span>
  );
}

/**
 * A partner's message whose words can be tapped for their meaning (D197):
 * the reply's glossary when it has the word, else a dictionary link.
 */
function TappableText({
  text,
  glossary,
}: {
  text: string;
  glossary: { word: string; zh: string }[];
}) {
  const t = useTranslations("writingChat");
  const [open, setOpen] = useState<string | null>(null);
  const parts = text.split(/(\s+)/);
  const meaning = (word: string) => {
    const key = word.toLowerCase();
    return glossary.find(
      (g) =>
        g.word.toLowerCase() === key ||
        g.word.toLowerCase().split(/\s+/).includes(key),
    );
  };
  return (
    <>
      {parts.map((part, i) => {
        const word = part.replace(/^[^\p{L}']+|[^\p{L}']+$/gu, "");
        if (!word) return <Fragment key={i}>{part}</Fragment>;
        const lead = part.slice(0, part.indexOf(word));
        const tail = part.slice(part.indexOf(word) + word.length);
        return (
          <Fragment key={i}>
            {lead}
            <button
              type="button"
              onClick={() => setOpen(open === `${i}` ? null : `${i}`)}
              aria-expanded={open === `${i}`}
              className="rounded-sm cursor-pointer underline decoration-line decoration-dotted underline-offset-4 hover:decoration-ink"
            >
              {word}
            </button>
            {open === `${i}` && (
              <span
                role="status"
                className="mx-1 inline-block rounded-base border border-line bg-ground px-2 text-supporting"
                lang="zh-Hant"
              >
                {meaning(word)?.zh ?? (
                  <a
                    href={`https://dictionary.cambridge.org/dictionary/english-chinese-traditional/${encodeURIComponent(word.toLowerCase())}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {t("room.dictionary")}
                  </a>
                )}
              </span>
            )}
            {tail}
          </Fragment>
        );
      })}
    </>
  );
}

function Correction({ message }: { message: ChatMessage }) {
  const t = useTranslations("writingChat");
  const c = message.correction;
  if (!c) return null;
  return (
    <details className="group mt-1 self-end text-supporting">
      <summary className="ml-auto tap flex min-h-8 cursor-pointer list-none items-center gap-1 text-ink-muted pointer-coarse:min-h-11">
        <span aria-hidden="true">✎</span> {t("room.tip")}
      </summary>
      <dl className="mt-1 grid max-w-sm gap-1 rounded-base border border-line bg-surface p-3">
        <dt className="text-ink-muted">{t("room.fixed")}</dt>
        <dd lang="en">{c.fixed}</dd>
        <dt className="text-ink-muted">{t("room.why")}</dt>
        <dd>{c.why}</dd>
        {c.natural && c.natural !== c.fixed && (
          <>
            <dt className="text-ink-muted">{t("room.natural")}</dt>
            <dd lang="en">{c.natural}</dd>
          </>
        )}
      </dl>
    </details>
  );
}

/**
 * The chat itself (D197): the partner's avatar and name, the countdown,
 * messages as bubbles (theirs left, the learner's right), a typing
 * indicator, and the box. Each message gets the partner's reply; a
 * mistake shows only as a small mark under the learner's message,
 * opened on request, so the conversation isn't interrupted.
 */
export function ChatRoom({
  setup,
  sessionId,
  startedAt,
  partner,
  opening,
  onEnd,
}: {
  setup: ChatSetup;
  sessionId: string;
  startedAt: string;
  partner: string;
  /** The partner's first message. */
  opening: string;
  onEnd: (messages: ChatMessage[], stopped: boolean) => void;
}) {
  const t = useTranslations("writingChat");
  const ref = useRef<HTMLDivElement>(null);
  useFitToViewport(ref, { full: true });
  // Chatting is writing practice: its time shows on the calendars (D201).
  usePracticeTimer(writingTimeId(CHAT_TIME_ID), false);
  const list = useRef<HTMLOListElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { from: "them", text: opening, at: startedAt },
  ]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<ChatReplyResult | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [reporting, setReporting] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [crisis, setCrisis] = useState(false);
  const ended = useRef(false);
  const end = Date.parse(startedAt) + setup.minutes * 60_000;
  const left = Math.max(0, Math.round((end - now) / 1000));

  const finish = (all: ChatMessage[], stopped = false) => {
    if (ended.current) return;
    ended.current = true;
    void endChat({ sessionId }).catch(() => {});
    onEnd(all, stopped);
  };

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const latest = useRef(messages);
  useEffect(() => {
    latest.current = messages;
    list.current?.lastElementChild?.scrollIntoView({ block: "end" });
  }, [messages, typing]);
  // Time's up: the chat ends (a reply on its way still arrives first).
  useEffect(() => {
    if (left > 0 || typing || crisis) return;
    const timer = window.setTimeout(() => finish(latest.current), 0);
    return () => window.clearTimeout(timer);
  });

  const send = async () => {
    const message = text.trim();
    if (!message || typing || left <= 0 || crisis) return;
    const mine: ChatMessage = {
      from: "me",
      text: message,
      at: new Date().toISOString(),
    };
    const before = messages;
    setMessages([...before, mine]);
    setText("");
    setError(null);
    setTyping(true);
    try {
      const result = await sendChat({
        sessionId,
        scenario: setup.scenario,
        custom: setup.custom,
        level: setup.level,
        teen: setup.teen,
        history: before.map(({ from, text }) => ({ from, text })),
        message,
      });
      if (!result.ok) {
        setError(result);
        if (
          result.reason === "ended" ||
          result.reason === "tooMany" ||
          result.reason === "plan"
        ) {
          finish([...before, mine]);
        }
        return;
      }
      const { turn } = result;
      const reply: ChatMessage = {
        from: "them",
        text: turn.reply,
        at: new Date().toISOString(),
        ...(turn.phrase ? { phrase: turn.phrase } : {}),
        ...(turn.glossary.length ? { glossary: turn.glossary } : {}),
        ...(turn.safety !== "ok" ? { safety: turn.safety } : {}),
      };
      const next = [
        ...before,
        turn.correction ? { ...mine, correction: turn.correction } : mine,
        reply,
      ];
      setMessages(next);
      if (turn.safety === "self-harm") {
        // Out of the role-play: help first; the chat has ended.
        ended.current = true;
        setCrisis(true);
      }
    } catch {
      setError({ ok: false, reason: "failed" });
    } finally {
      setTyping(false);
    }
  };

  const keys = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void send();
  };

  return (
    <div
      ref={ref}
      data-testid="chat-room"
      className="flex h-dvh min-h-80 flex-col rounded-base border border-line bg-surface"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-2">
        <Avatar name={partner} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{partner}</p>
          <p className="truncate text-supporting text-ink-muted">
            {setup.scenario === "custom" && setup.custom
              ? setup.custom
              : t(`scenarios.${setup.scenario}.name`)}
          </p>
        </div>
        <p
          className="shrink-0 text-supporting tabular-nums"
          aria-label={t("room.timeLeft", { time: clock(left) })}
        >
          {clock(left)}
        </p>
        {!crisis && (
          <Button size="sm" variant="ghost" onClick={() => finish(messages)}>
            {t("room.end")}
          </Button>
        )}
      </header>
      <ol
        ref={list}
        aria-label={t("room.messages")}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3"
      >
        {messages.map((m, i) =>
          m.from === "them" ? (
            <li key={i} className="flex max-w-[85%] items-end gap-2">
              <Avatar name={partner} />
              <div className="flex flex-col gap-1">
                <p
                  lang={m.safety === "self-harm" ? "zh-Hant" : "en"}
                  className="rounded-base border border-line bg-ground px-3 py-2"
                >
                  <span className="sr-only">{partner}: </span>
                  {m.safety === "self-harm" ? (
                    m.text
                  ) : (
                    <TappableText text={m.text} glossary={m.glossary ?? []} />
                  )}
                </p>
                {i > 0 && m.safety !== "self-harm" && (
                  <button
                    type="button"
                    onClick={() => setReporting(i)}
                    disabled={m.reported}
                    className="tap self-start text-metadata text-ink-muted underline disabled:no-underline"
                  >
                    {m.reported ? t("room.reported") : t("room.report")}
                  </button>
                )}
              </div>
            </li>
          ) : (
            <li key={i} className="flex max-w-[85%] flex-col self-end">
              <p
                lang="en"
                className="rounded-base bg-accent/14 px-3 py-2 text-ink"
              >
                <span className="sr-only">{t("room.me")}: </span>
                {m.text}
              </p>
              <Correction message={m} />
            </li>
          ),
        )}
        {typing && (
          <li className="flex items-center gap-2" aria-live="polite">
            <Avatar name={partner} />
            <span className="rounded-base border border-line bg-ground px-3 py-2 text-ink-muted motion-safe:animate-pulse">
              <span aria-hidden="true">• • •</span>
              <span className="sr-only">{t("room.typing", { partner })}</span>
            </span>
          </li>
        )}
      </ol>
      {crisis ? (
        <Card role="alert" className="m-3 flex flex-col gap-3">
          <p className="font-medium">{t("safety.title")}</p>
          <p>{t("safety.body")}</p>
          <ul className="flex flex-col gap-1">
            {HELPLINES.map((line) => (
              <li key={line.id}>
                <a href={`tel:${line.phone}`} className="underline">
                  {t(`safety.lines.${line.id}`)}
                </a>
              </li>
            ))}
          </ul>
          <div>
            <Button variant="secondary" onClick={() => onEnd(messages, true)}>
              {t("safety.leave")}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="flex shrink-0 flex-col gap-2 border-t border-line p-3">
          {error && !error.ok && (
            <div role="alert" className="flex flex-col gap-1 text-supporting">
              <p className="text-error">{t(`errors.${error.reason}`)}</p>
              {error.reason === "plan" && (
                <UpsellToAll need="writing" feature="chat" />
              )}
              {/* Blocked by the provider's filter: it may have been about
                  self-harm, so help is offered too (D197). */}
              {error.reason === "filtered" && (
                <p>
                  {t("safety.filtered")}{" "}
                  {HELPLINES.map((line, i) => (
                    <span key={line.id}>
                      {i > 0 && "、"}
                      <a href={`tel:${line.phone}`} className="underline">
                        {t(`safety.lines.${line.id}`)}
                      </a>
                    </span>
                  ))}
                </p>
              )}
            </div>
          )}
          <div className="flex items-end gap-2">
            <label htmlFor="chat-message" className="sr-only">
              {t("room.label", { partner })}
            </label>
            <textarea
              id="chat-message"
              lang="en"
              rows={2}
              value={text}
              maxLength={MAX_MESSAGE}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={keys}
              placeholder={t("room.placeholder")}
              autoCapitalize="sentences"
              disabled={left <= 0}
              className="min-h-11 w-full min-w-0 flex-1 resize-none rounded-base border border-line bg-ground p-2 focus:border-ink"
            />
            <Button
              variant="primary"
              onClick={() => void send()}
              disabled={!text.trim() || typing || left <= 0}
            >
              {t("room.send")}
            </Button>
          </div>
        </div>
      )}
      {reporting !== null && (
        <Dialog
          title={t("report.title")}
          onClose={() => {
            setReporting(null);
            setReason("");
          }}
        >
          <form
            className="flex flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const index = reporting;
              const target = messages[index];
              setReporting(null);
              await reportChatReply({
                scenario: setup.scenario,
                reply: target.text,
                reason,
              }).catch(() => ({ ok: false }));
              setReason("");
              setMessages((all) =>
                all.map((m, i) => (i === index ? { ...m, reported: true } : m)),
              );
            }}
          >
            <p className="text-supporting text-ink-muted">{t("report.note")}</p>
            <label className="flex flex-col gap-1">
              <span>{t("report.reason")}</span>
              <textarea
                rows={2}
                value={reason}
                maxLength={300}
                onChange={(e) => setReason(e.target.value)}
                className="rounded-base border border-line bg-surface p-2"
              />
            </label>
            <div>
              <Button type="submit" variant="primary">
                {t("report.send")}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}

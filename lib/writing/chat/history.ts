import {
  CHAT_LEVELS,
  CHAT_SCENARIOS,
  type ChatLevel,
  type ChatMessage,
  type ChatScenario,
} from "./types";

/**
 * Past chats (D197): only the learner's, in this browser
 * (ll-writing-chats:v1) and, signed in, the account's own documents
 * (`writing-chats`, RLS: only them). Deleting one leaves a mark so the
 * deletion syncs; the newest MAX_CHATS are kept.
 */
export type ChatRecord = {
  id: string;
  scenario: ChatScenario;
  custom?: string;
  level: ChatLevel;
  minutes: number;
  startedAt: string;
  endedAt?: string;
  messages: ChatMessage[];
  updatedAt: string;
  deleted?: boolean;
};

export const CHATS_KEY = "ll-writing-chats:v1";
export const MAX_CHATS = 20;
export const MAX_CHAT_MESSAGES = 80;

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

function parseMessage(value: unknown): ChatMessage | null {
  if (!isObject(value)) return null;
  if (value.from !== "me" && value.from !== "them") return null;
  if (typeof value.text !== "string" || typeof value.at !== "string") {
    return null;
  }
  return value as ChatMessage;
}

export function parseChatRecord(value: unknown): ChatRecord | null {
  if (!isObject(value) || typeof value.id !== "string") return null;
  const scenario = CHAT_SCENARIOS.find((s) => s === value.scenario);
  const level = CHAT_LEVELS.find((l) => l === value.level);
  if (!scenario || !level || typeof value.startedAt !== "string") return null;
  const messages = (Array.isArray(value.messages) ? value.messages : [])
    .map(parseMessage)
    .filter((m): m is ChatMessage => m !== null)
    .slice(0, MAX_CHAT_MESSAGES);
  return {
    id: value.id,
    scenario,
    ...(typeof value.custom === "string" ? { custom: value.custom } : {}),
    level,
    minutes: Number(value.minutes) || 0,
    startedAt: value.startedAt,
    ...(typeof value.endedAt === "string" ? { endedAt: value.endedAt } : {}),
    messages,
    updatedAt:
      typeof value.updatedAt === "string" ? value.updatedAt : value.startedAt,
    ...(value.deleted === true ? { deleted: true } : {}),
  };
}

export function parseChats(value: unknown): ChatRecord[] {
  const list = isObject(value) && Array.isArray(value.chats) ? value.chats : [];
  return list
    .map(parseChatRecord)
    .filter((c): c is ChatRecord => c !== null)
    .slice(0, MAX_CHATS);
}

export function mergeChats(
  a: readonly ChatRecord[],
  b: readonly ChatRecord[],
): ChatRecord[] {
  const byId = new Map<string, ChatRecord>();
  for (const chat of [...a, ...b]) {
    const seen = byId.get(chat.id);
    if (!seen || chat.updatedAt > seen.updatedAt) byId.set(chat.id, chat);
  }
  return [...byId.values()]
    .sort((x, y) => (x.startedAt < y.startedAt ? 1 : -1))
    .slice(0, MAX_CHATS);
}

/** A deleted chat keeps only what syncing the deletion needs. */
export const deletedChat = (
  chat: ChatRecord,
  now = new Date(),
): ChatRecord => ({
  ...chat,
  messages: [],
  custom: undefined,
  deleted: true,
  updatedAt: now.toISOString(),
});

import type { ErrorType } from "../types";

/**
 * Chat practice (D197): a direct-message style conversation with an
 * AI partner in a chosen situation, timed, corrected quietly. Shared by
 * the provider, the server action, the eval, and the pages.
 */
export const CHAT_SCENARIOS = [
  "classmate",
  "professor",
  "coworker",
  "barista",
  "roommate",
  "online-friend",
  "interviewer",
  "custom",
] as const;
export type ChatScenario = (typeof CHAT_SCENARIOS)[number];

export const CHAT_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type ChatLevel = (typeof CHAT_LEVELS)[number];

/** Session lengths to choose from, in minutes. */
export const CHAT_LENGTHS = [5, 10, 20] as const;
export type ChatLength = (typeof CHAT_LENGTHS)[number];

/** The partner's side of one turn, as the model answers (the schema). */
export type ChatTurn = {
  /**
   * "ok": a normal reply; "redirect": the request was out of bounds
   * (romance, sex, violence, crime, role changes) and the reply steers
   * back; "self-harm": the practice stops and help is offered.
   */
  safety: "ok" | "redirect" | "self-harm";
  /** The partner's message: 1–3 short sentences. */
  reply: string;
  /** The learner's last message, corrected; null when it was fine. */
  correction: ChatCorrection | null;
  /** One natural expression from the reply worth learning. */
  phrase: { en: string; zh: string } | null;
  /** Harder words of the reply, with their meaning in Chinese. */
  glossary: { word: string; zh: string }[];
};

export type ChatCorrection = {
  /** What the learner wrote (their message, or the part with the problem). */
  original: string;
  /** The same message, corrected. */
  fixed: string;
  /** Why, in Chinese, one sentence. */
  why: string;
  /** A more natural way to say it (may equal `fixed`). */
  natural: string;
  /** The message's meaning in Chinese, for reviewing it later. */
  zh: string;
  type: ErrorType;
  /** 1 small, 2 clear, 3 changes the meaning. */
  severity: 1 | 2 | 3;
};

export type ChatMessage = {
  from: "me" | "them";
  text: string;
  /** ISO time. */
  at: string;
  /** On the learner's messages: the quiet correction. */
  correction?: ChatCorrection;
  /** On the partner's messages. */
  phrase?: { en: string; zh: string };
  glossary?: { word: string; zh: string }[];
  /** The partner's message was reported. */
  reported?: boolean;
  /** A safety reply (help resources shown). */
  safety?: "redirect" | "self-harm";
};

/** What the model is given each turn (as data, never as instructions). */
export type ChatTurnInput = {
  scenario: ChatScenario;
  /** The learner's own situation, for "custom" (at most 200 characters). */
  custom?: string;
  level: ChatLevel;
  /** 13–17: age-appropriate rules apply. */
  teen: boolean;
  /** The conversation so far, oldest first (the last few turns). */
  history: { from: "me" | "them"; text: string }[];
  /** The learner's new message. */
  message: string;
};

/**
 * Opening sign-ups in stages (D132): a cap on accounts and a switch for
 * public sign-ups, invites that skip the cap, and a waiting list. The
 * pure parts: invite codes, an invite's state, and the form checks.
 */

/** The cap Joe set for the closed Beta (2026-11-11). */
export const DEFAULT_SIGNUP_CAP = 50;

/** Cookie holding an invite code until the first sign-in, 30 days. */
export const INVITE_COOKIE = "ll-invite";
export const INVITE_COOKIE_SECONDS = 30 * 24 * 3600;

/**
 * Codes are 8 characters from an alphabet without look-alikes (no 0/O,
 * 1/I/L), so one read out loud or typed from a screenshot still works.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newInviteCode(
  random: (n: number) => Uint8Array = (n) =>
    crypto.getRandomValues(new Uint8Array(n)),
): string {
  // Rejection sampling keeps every character equally likely.
  const limit = 256 - (256 % ALPHABET.length);
  let code = "";
  while (code.length < 8) {
    for (const byte of random(16)) {
      if (byte < limit && code.length < 8) {
        code += ALPHABET[byte % ALPHABET.length];
      }
    }
  }
  return code;
}

/** A code as typed or pasted: trimmed and upper case; null if not one. */
export function cleanInviteCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9]{8}$/.test(code) ? code : null;
}

export type InviteRow = {
  max_uses: number;
  uses: number;
  expires_at: string | null;
  revoked_at: string | null;
};

export type InviteState = "active" | "used-up" | "expired" | "revoked";

export function inviteState(invite: InviteRow, now: Date): InviteState {
  if (invite.revoked_at) return "revoked";
  if (invite.expires_at && new Date(invite.expires_at) <= now) return "expired";
  if (invite.uses >= invite.max_uses) return "used-up";
  return "active";
}

/** What admit_account answered. */
export type Admission =
  "admitted" | "invite" | "open" | "admin" | "full" | "closed";

export const isAdmitted = (answer: string): boolean =>
  ["admitted", "invite", "open", "admin"].includes(answer);

/** What someone on the waiting list wrote, checked. */
export type WaitlistEntry = { email: string; purpose: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PURPOSE_MAX = 500;

export function cleanWaitlistEntry(input: {
  email: unknown;
  purpose: unknown;
}): WaitlistEntry | null {
  const email =
    typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const purpose =
    typeof input.purpose === "string"
      ? input.purpose.replace(/\s+/g, " ").trim()
      : "";
  if (!EMAIL.test(email) || email.length > 254) return null;
  if ([...purpose].length > PURPOSE_MAX) return null;
  return { email, purpose };
}

/** The settings form: a cap 0–1,000,000 and the switch. */
export function cleanSignupSettings(input: {
  open: unknown;
  cap: unknown;
}): { open: boolean; cap: number } | null {
  const cap = Number(input.cap);
  if (!Number.isInteger(cap) || cap < 0 || cap > 1_000_000) return null;
  if (typeof input.open !== "boolean") return null;
  return { open: input.open, cap };
}

/** A new invite's options: uses 1–10,000, valid 1–365 days or forever. */
export function cleanInviteOptions(input: {
  maxUses: unknown;
  days: unknown;
  note: unknown;
}): { maxUses: number; days: number | null; note: string } | null {
  const maxUses = Number(input.maxUses);
  const days =
    input.days === null || input.days === "" ? null : Number(input.days);
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 10_000) {
    return null;
  }
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 365)) {
    return null;
  }
  if ([...note].length > 200) return null;
  return { maxUses, days, note };
}

/** An invite's link, on this site. */
export const inviteUrl = (origin: string, code: string) =>
  `${origin}/invite/${code}`;

/**
 * Accounts (D50): roles and statuses as the profiles table stores them,
 * and the number shown for a user on the admin pages.
 */
export const ROLES = ["admin", "user"] as const;
export type Role = (typeof ROLES)[number];

export const ACCOUNT_STATUSES = ["active", "disabled"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const isRole = (value: unknown): value is Role =>
  (ROLES as readonly unknown[]).includes(value);

export const isAccountStatus = (value: unknown): value is AccountStatus =>
  (ACCOUNT_STATUSES as readonly unknown[]).includes(value);

/** "001" for user 1: at least three digits, more when needed. */
export function userNumberLabel(number: number | null): string {
  return number === null ? "—" : String(number).padStart(3, "0");
}

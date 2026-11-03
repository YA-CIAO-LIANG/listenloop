/**
 * Admin accounts (docs/decisions.md D5): the comma-separated emails in
 * ADMIN_EMAILS, compared case-insensitively. Checked on the server only;
 * the list never reaches the browser.
 */
export function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0),
  );
}

/** Whether `email` is on the admin list (none when the list is empty). */
export function isAdminEmail(
  email: string | undefined,
  raw: string | undefined = process.env.ADMIN_EMAILS,
): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  return parseAdminEmails(raw).has(normalized);
}

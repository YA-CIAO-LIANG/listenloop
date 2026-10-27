/** A calendar day on the user's device, e.g. "2026-10-24". */
export type LocalDate = string;

/** The device-local calendar day of `date` (not UTC). */
export function toLocalDate(date: Date): LocalDate {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/** True when `later` is a later calendar day than `earlier`. */
export function isLaterDay(later: LocalDate, earlier: LocalDate): boolean {
  // Zero-padded YYYY-MM-DD strings sort chronologically.
  return later > earlier;
}

/** Whole calendar days from `earlier` to `later` (negative if before). */
export function daysBetween(earlier: LocalDate, later: LocalDate): number {
  const [ya, ma, da] = earlier.split("-").map(Number);
  const [yb, mb, db] = later.split("-").map(Number);
  return Math.round(
    (Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000,
  );
}

/**
 * The student plan (D144): Plus at a student price, for anyone who signs
 * in with a school Google account. No email is sent: the school domain of
 * the signed-in account is the proof, good for a year; after that, signing
 * in again with the school account renews it. Domains live here only.
 */

/**
 * School email domains: an address ends with one of these (after "@" or a
 * subdomain's "."). Common ones in Taiwan and where Taiwanese students
 * study abroad.
 */
export const STUDENT_EMAIL_SUFFIXES = [
  "edu", // United States, and many schools elsewhere
  "edu.tw", // Taiwan
  "ac.uk", // United Kingdom
  "edu.au", // Australia
  "ac.nz", // New Zealand
  "ac.jp", // Japan
  "ac.kr", // South Korea
  "edu.hk", // Hong Kong
  "edu.sg", // Singapore
  "edu.my", // Malaysia
  "edu.cn", // China
  "edu.mo", // Macau
] as const;

/**
 * Schools without a school suffix (Canada has none): whole domains. Kept
 * short; add a school here when students ask.
 */
export const STUDENT_EMAIL_DOMAINS = [
  "utoronto.ca",
  "mail.utoronto.ca",
  "ubc.ca",
  "student.ubc.ca",
  "mcgill.ca",
  "mail.mcgill.ca",
  "uwaterloo.ca",
] as const;

/** How long a verification lasts, in days. */
export const STUDENT_VERIFICATION_DAYS = 365;

/** Whether an email address is a school one (case-insensitive). */
export function isStudentEmail(email: string | null | undefined): boolean {
  const at = email?.lastIndexOf("@") ?? -1;
  if (!email || at < 1) return false;
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(domain) || !domain.includes(".")) return false;
  if ((STUDENT_EMAIL_DOMAINS as readonly string[]).includes(domain)) {
    return true;
  }
  return STUDENT_EMAIL_SUFFIXES.some(
    (suffix) =>
      domain.endsWith(`.${suffix}`) &&
      // A school's own name before the suffix: not "edu.tw" alone.
      domain.length > suffix.length + 1,
  );
}

export type StudentStatus =
  | { state: "verified"; until: string }
  | { state: "expired"; until: string }
  | { state: "none" };

/** Where a verification made at `verifiedAt` stands at `now`. */
export function studentStatus(
  verifiedAt: string | null | undefined,
  now: Date = new Date(),
): StudentStatus {
  const at = verifiedAt ? Date.parse(verifiedAt) : NaN;
  if (Number.isNaN(at)) return { state: "none" };
  const until = new Date(at + STUDENT_VERIFICATION_DAYS * 86_400_000);
  return {
    state: until.getTime() > now.getTime() ? "verified" : "expired",
    until: until.toISOString(),
  };
}

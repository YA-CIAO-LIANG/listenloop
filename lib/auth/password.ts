/**
 * Password rules for email sign-up (D101), after NIST SP 800-63B: length
 * matters most, so no "one digit and one symbol" rules; common passwords
 * and ones built from the email are refused; any characters (spaces,
 * Chinese) are allowed. Supabase hashes and stores the password.
 */
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 72; // bcrypt's limit

/** The most common passwords (and their likes), refused outright. */
const COMMON = new Set([
  "1234567890",
  "12345678910",
  "0123456789",
  "1111111111",
  "0000000000",
  "qwertyuiop",
  "1q2w3e4r5t",
  "password123",
  "password1234",
  "passw0rd123",
  "iloveyou123",
  "abcdefghij",
  "abc1234567",
  "qwerty1234",
  "aaaaaaaaaa",
  "listenloop",
  "listenloop123",
  "welcome123",
  "letmein123",
  "football123",
  "monkey12345",
  "princess123",
  "sunshine123",
  "zaq12wsxcde",
  "asdfghjkl1",
]);

export type PasswordProblem = "short" | "long" | "common" | "email";
export type PasswordStrength = "weak" | "fair" | "strong";

export function passwordProblem(
  password: string,
  email = "",
): PasswordProblem | null {
  const length = [...password].length;
  if (length < PASSWORD_MIN) return "short";
  if (new TextEncoder().encode(password).length > PASSWORD_MAX) return "long";
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password)) return "common";
  const name = email.split("@")[0]?.toLowerCase() ?? "";
  if (name.length >= 4 && lower.includes(name)) return "email";
  return null;
}

/** For the meter under the field: longer and more varied is stronger. */
export function passwordStrength(password: string): PasswordStrength {
  if (passwordProblem(password) !== null) return "weak";
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z\d]/].filter((r) =>
    r.test(password),
  ).length;
  const length = [...password].length;
  return length >= 16 || (length >= 12 && kinds >= 3) ? "strong" : "fair";
}

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Webhook signatures (D85), in the common "t=<unix seconds>,v1=<hex>"
 * form: an HMAC-SHA256 of "<t>.<raw body>" with a secret only we and the
 * provider know. Checking the time too stops an old request being sent
 * again (a replay); comparing in constant time leaks nothing.
 */
export const SIGNATURE_HEADER = "x-listenloop-signature";

/** How old a signed request may be, either way (clock drift). */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

const digest = (secret: string, timestamp: number, body: string) =>
  createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

export function signPayload(secret: string, body: string, now: Date): string {
  const timestamp = Math.floor(now.getTime() / 1000);
  return `t=${timestamp},v1=${digest(secret, timestamp, body)}`;
}

export function verifySignature(
  secret: string,
  body: string,
  header: string | null,
  now: Date,
): boolean {
  if (!secret || !header) return false;
  const parts = new Map(
    header.split(",").map((part) => {
      const at = part.indexOf("=");
      return [part.slice(0, at).trim(), part.slice(at + 1).trim()] as const;
    }),
  );
  const timestamp = Number(parts.get("t"));
  const given = parts.get("v1") ?? "";
  if (!Number.isInteger(timestamp) || !/^[0-9a-f]{64}$/.test(given)) {
    return false;
  }
  const age = Math.abs(now.getTime() / 1000 - timestamp);
  if (age > SIGNATURE_TOLERANCE_SECONDS) return false;
  const expected = Buffer.from(digest(secret, timestamp, body), "hex");
  return timingSafeEqual(expected, Buffer.from(given, "hex"));
}

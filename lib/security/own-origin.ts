import { SITE_URL } from "@/lib/site";

/**
 * This site's own address, or a local one (development, E2E), for
 * server-side requests that carry the learner's cookie (D192): never to
 * an address taken from a forged Host header.
 */
export function isOwnOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      url.origin === new URL(SITE_URL).origin ||
      ["localhost", "127.0.0.1"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

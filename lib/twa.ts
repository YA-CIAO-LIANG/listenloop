/**
 * The Android app (Trusted Web Activity, D178): Chrome opens the site
 * full screen once the site vouches for the app in
 * /.well-known/assetlinks.json (Digital Asset Links). The package name
 * and signing-key fingerprints come from the environment, so publishing
 * the app only needs env vars in Vercel, not a code change:
 *
 * - TWA_PACKAGE_NAME: the app's package (application) ID, e.g.
 *   app.listenloop.twa (android/twa-manifest.json's packageId);
 * - TWA_SHA256_FINGERPRINTS: comma-separated SHA-256 fingerprints of the
 *   upload key and of Google Play's app signing key.
 *
 * Either one missing (or nothing valid in it): an empty list, which
 * vouches for no app.
 */

export type AssetLinkStatement = {
  relation: string[];
  target: {
    namespace: "android_app";
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
};

/** A Java package name with at least two parts, as Play requires. */
const PACKAGE_NAME = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;

/** 32 bytes in hex, colon-separated: what keytool and Play Console show. */
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

/** "ab:cd…" or "ABCD…" (no colons) → "AB:CD:…"; null when not 32 bytes. */
export function normalizeFingerprint(value: string): string | null {
  const hex = value
    .trim()
    .toUpperCase()
    .replace(/^SHA-?256:\s*/, "");
  const colons = /^[0-9A-F]{64}$/.test(hex)
    ? (hex.match(/../g) ?? []).join(":")
    : hex;
  return FINGERPRINT.test(colons) ? colons : null;
}

export function assetLinksFromEnv(
  env: Record<string, string | undefined> = process.env,
): AssetLinkStatement[] {
  const packageName = env.TWA_PACKAGE_NAME?.trim() ?? "";
  if (!PACKAGE_NAME.test(packageName)) return [];
  const fingerprints = [
    ...new Set(
      (env.TWA_SHA256_FINGERPRINTS ?? "")
        .split(/[,\s]+/)
        .filter(Boolean)
        .map(normalizeFingerprint)
        .filter((value): value is string => value !== null),
    ),
  ];
  if (fingerprints.length === 0) return [];
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}

/**
 * Android opens the app's first page with the app as the referrer
 * ("android-app://<package>/"); later pages don't carry it, so the page
 * remembers it for the session (components/TwaMarker.tsx).
 */
export const TWA_REFERRER_PREFIX = "android-app://";

export function isTwaReferrer(referrer: string): boolean {
  return referrer.startsWith(TWA_REFERRER_PREFIX);
}
